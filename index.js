"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const vm2_1 = __importDefault(require("vm2"));
const { VM } = vm2_1.default;
const resend_1 = require("resend");
const ioredis_1 = require("ioredis");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_scheduler_1 = require("@aws-sdk/client-scheduler");
const supabase_js_1 = require("@supabase/supabase-js");
const mailparser_1 = __importDefault(require("mailparser"));
const { simpleParser } = mailparser_1.default;
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const nanoid_1 = require("nanoid");
const buffer_1 = require("buffer");
const url_1 = require("url");
const crypto_1 = __importDefault(require("crypto"));
const handler = async (event) => {
    if (!process.env.NEXT_PUBLIC_PRODUCTION_URL || !process.env.NEXT_PUBLIC_PRODUCTION_AUTH_URL) {
        return {
            statusCode: 400,
            error: 'NEXT_PUBLIC_PRODUCTION_URL or NEXT_PUBLIC_PRODUCTION_AUTH_URL missing',
        };
    }
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const imports = {
        Resend: resend_1.Resend,
        Redis: ioredis_1.Redis,
        GetObjectCommand: client_s3_1.GetObjectCommand,
        DeleteObjectCommand: client_s3_1.DeleteObjectCommand,
        S3Client: client_s3_1.S3Client,
        DeleteScheduleCommand: client_scheduler_1.DeleteScheduleCommand,
        SchedulerClient: client_scheduler_1.SchedulerClient,
        createClient: supabase_js_1.createClient,
        simpleParser,
        nanoid: nanoid_1.nanoid,
        crypto: crypto_1.default,
        moment: moment_timezone_1.default,
        encoder,
        decoder,
        Buffer: buffer_1.Buffer,
        URLSearchParams: // required for twilio Authorization token
        url_1.URLSearchParams,
    };
    const response = await fetch(`${process.env.NEXT_PUBLIC_PRODUCTION_AUTH_URL}api/lambda/VM-receiveEmails`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": process.env.NEXT_PUBLIC_PRODUCTION_URL, // Non-null assertion, validated above
        },
        cache: "no-cache", // Should be no cache to improve security
    });
    if (!response.ok) {
        const errorMessage = await response.text(); // Get the error message from the response body
        throw new Error(`Error ${response.status}: ${errorMessage || "Unknown error"}`);
    }
    const responseData = await response.json();
    const vm = new VM({
        timeout: 25000,
        sandbox: {
            process: {
                env: { ...process.env },
            },
            fetch,
            event,
            imports
        },
    });
    try {
        // Make sure that responseData.code it's a index.js file that comes as a result of "tsc" command with "ESNext" in tsconfig.json
        const transformedCode = responseData.code
            // Remove the export handler function line, adjusting to potentially varying spaces
            .replace("export const handler = async (event) => {", '') // Remove handler definition line
            .replace("};", ''); // Remove only the last closing `};`
        const wrappedCode = `  
    const { 
    Resend,
    Redis,
    GetObjectCommand,
    DeleteObjectCommand,
    S3Client,
    DeleteScheduleCommand,
    SchedulerClient,
    createClient,
    simpleParser,
    nanoid,
    crypto,
    moment,
    encoder,
    decoder,
    Buffer,
    URLSearchParams} = imports;

    (async () => {
      try {
        const result = await (async () => { 
          ${transformedCode} 
        })();

        if (result?.statusCode !== 200) {
          throw new Error(result.body);
        }

        return result;
      } catch (error) {
        return { statusCode: 400, body: error.message };
      }
    })();
  `;
        // Execute the wrapped code in the VM
        const result = await vm.run(wrappedCode);
        if (result?.statusCode !== 200) {
            const cleanedError = result.body.replace(/\\n/g, "\n").replace(/\\/g, '').replace(/\\/g, '');
            throw new Error(cleanedError);
        }
        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    }
    catch (error) {
        const message = (error instanceof Error && typeof error.message === 'string')
            ? error.message
            : JSON.stringify(error);
        const cleanErrorMessage = message
            .replace(/\\n/g, "\n") // Replace \\n with newline character
            .replace(/\\/g, '') // Remove backslashes
            .trim(); // Remove leading and trailing whitespace
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to execute the code',
                details: cleanErrorMessage,
            }),
        };
    }
};
exports.handler = handler;
