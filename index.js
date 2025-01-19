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
const nanoid_1 = require("nanoid");
const crypto_1 = __importDefault(require("crypto"));
function validateEvent(event) {
    const requiredFields = ['dateTime', 'message', 'sendNotificationTo'];
    for (const field of requiredFields) {
        if (!event[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }
}
const handler = async (event) => {
    const requiredEnvVariables = [
        "SEND_EMAILS_TO",
        "REGION",
        "ACCESS_KEY_ID",
        "SECRET_ACCESS_KEY",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
        "UPSTASH_REDIS_URL",
        "USER_ID",
        'NEXT_PUBLIC_PRODUCTION_URL',
        'NEXT_PUBLIC_PRODUCTION_AUTH_URL',
    ];
    // 1. Validate envs
    requiredEnvVariables.forEach((variable) => {
        if (!process.env[variable]) {
            const errorMessage = `no ${variable} - check your envs in AWS Lambda receiveEmails Configuration Environment variables`;
            console.log(94, errorMessage);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: errorMessage }),
            };
        }
    });
    validateEvent(event);
    const imports = {
        Resend: resend_1.Resend,
        Redis: ioredis_1.Redis,
        GetObjectCommand: client_s3_1.GetObjectCommand,
        DeleteObjectCommand: client_s3_1.DeleteObjectCommand,
        S3Client: client_s3_1.S3Client,
        DeleteScheduleCommand: client_scheduler_1.DeleteScheduleCommand,
        createClient: supabase_js_1.createClient,
        simpleParser,
        nanoid: nanoid_1.nanoid,
        crypto: crypto_1.default,
    };
    const response = await fetch(`${process.env.NEXT_PUBLIC_PRODUCTION_AUTH_URL}api/lambda/receiveEmails`, {
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
                env: {
                    SEND_EMAILS_TO: process.env.SEND_EMAILS_TO,
                    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
                    REGION: process.env.REGION,
                    ACCESS_KEY_ID: process.env.ACCESS_KEY_ID,
                    SECRET_ACCESS_KEY: process.env.SECRET_ACCESS_KEY,
                    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
                    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
                    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
                    UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL,
                    USER_ID: process.env.USER_ID,
                    NEXT_PUBLIC_PRODUCTION_URL: process.env.NEXT_PUBLIC_PRODUCTION_URL,
                    NEXT_PUBLIC_PRODUCTION_AUTH_URL: process.env.NEXT_PUBLIC_PRODUCTION_AUTH_URL
                },
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
   const { Resend, Redis, GetObjectCommand, DeleteObjectCommand, S3Client, DeleteScheduleCommand, createClient, simpleParser, nanoid, crypto } = imports;

  (async () => {
    ${transformedCode}
    })().then(result => result).catch(err => ({ statusCode: 500, body: JSON.stringify({ error: 'Failed to execute the VM2 code', details: err.message }) }));
    `;
        // Execute the wrapped code in the VM
        const result = await vm.run(wrappedCode);
        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    }
    catch (error) {
        const errorMessage = error?.message || 'An unexpected error occurred';
        console.error('Error executing code in VM:', errorMessage);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to execute the code',
                details: errorMessage,
            }),
        };
    }
};
exports.handler = handler;
