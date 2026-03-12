"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.decryptTelegramEnvs = void 0;
const vm2_1 = __importDefault(require("vm2"));
const { VM } = vm2_1.default;
const ioredis_1 = require("ioredis");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_scheduler_1 = require("@aws-sdk/client-scheduler");
const client_ses_1 = require("@aws-sdk/client-ses");
const supabase_js_1 = require("@supabase/supabase-js");
const pusher_1 = __importDefault(require("pusher"));
const mailparser_1 = __importDefault(require("mailparser"));
const { simpleParser } = mailparser_1.default;
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const nanoid_1 = require("nanoid");
const buffer_1 = require("buffer");
const url_1 = require("url");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const NEXT_PUBLIC_PRODUCTION_URL = "https://www.outreach-tool.com/";
const NEXT_PUBLIC_PRODUCTION_AUTH_URL = "https://auth.outreach-tool.com/";
// DO NOT use this function in VM - for some reason it work with smth else but doesn't work with redis
async function decryptDiscordWebhookUrl(encryptedDiscordWebhookUrl) {
    if (typeof window === "undefined") {
        try {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            // Define the secret key - mock data
            const secretKey = JSON.stringify({
                provider: ["supabase", "lambda", "discord"],
                APIKey: "replace-with-your-api-key",
            });
            // Convert the Base64-encoded string back to a Uint8Array
            const combined = buffer_1.Buffer.from(encryptedDiscordWebhookUrl, "base64");
            // Extract salt, IV, and ciphertext from the combined array
            const salt = Uint8Array.from(combined.slice(0, 16));
            const iv = combined.slice(16, 28);
            const ciphertext = combined.slice(28);
            // Create key material for PBKDF2
            const keyMaterial = await crypto_1.default.subtle.importKey("raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, [
                "deriveKey",
            ]);
            // Derive the decryption key using PBKDF2
            const key = await crypto_1.default.subtle.deriveKey({
                name: "PBKDF2",
                salt: salt,
                iterations: 328,
                hash: "SHA-256",
            }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
            // Decrypt the ciphertext
            const decrypted = await crypto_1.default.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
            // Return the decrypted plaintext as a string
            return [decoder.decode(decrypted)];
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during decryption.";
            return `Decryption failed: ${errorMessage}`;
        }
    }
    return "This function must be run on the server.";
}
async function decryptTelegramEnvs(encryptedBase64) {
    if (typeof window === "undefined") {
        try {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            const secretKey = JSON.stringify({ provider: ["redis", "lambda", "telegram"] });
            const encryptedBytes = buffer_1.Buffer.from(encryptedBase64, "base64");
            const salt = encryptedBytes.slice(0, 16);
            const iv = encryptedBytes.slice(16, 28);
            const ciphertext = encryptedBytes.slice(28);
            const keyMaterial = await crypto_1.default.subtle.importKey("raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, [
                "deriveKey",
            ]);
            const key = await crypto_1.default.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 328, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
            const decrypted = await crypto_1.default.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
            const json = decoder.decode(decrypted);
            const data = JSON.parse(json);
            const telegramBotToken = data.telegramBotToken;
            const telegramChatId = data.telegramChatId;
            // === FINAL VALIDATION ===
            if (typeof telegramBotToken !== "string" || telegramBotToken.trim() === "")
                return "Invalid telegramBotToken";
            if (typeof telegramChatId !== "string" || telegramChatId.trim() === "")
                return "Invalid telegramChatId";
            return { telegramBotToken, telegramChatId };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return `Decryption failed: ${message}`;
        }
    }
    return "This function must be run on the server.";
}
exports.decryptTelegramEnvs = decryptTelegramEnvs;
// DO NOT use this function in VM - for some reason it work with smth else but doesn't work with redis
// I tried to change environment from node 22 to node 20 and ask chatGPT - useless
async function decryptTwilioEnvs(encryptedBase64) {
    if (typeof window === "undefined") {
        try {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            // Define the secret key - mock data
            const secretKey = JSON.stringify({
                provider: ["redis", "lambda", "twilio"],
                APIKey: "replace-with-your-api-key",
            });
            // Convert the Base64-encoded string back to a Uint8Array
            const combined = buffer_1.Buffer.from(encryptedBase64, "base64");
            // Extract salt, IV, and ciphertext from the combined array
            const salt = Uint8Array.from(combined.slice(0, 16));
            const iv = combined.slice(16, 28);
            const ciphertext = combined.slice(28);
            // Create key material for PBKDF2
            const keyMaterial = await crypto_1.default.subtle.importKey("raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, [
                "deriveKey",
            ]);
            // Derive the decryption key using PBKDF2
            const key = await crypto_1.default.subtle.deriveKey({
                name: "PBKDF2",
                salt: salt,
                iterations: 328,
                hash: "SHA-256",
            }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
            const decrypted = await crypto_1.default.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
            const twilioEnvs = JSON.parse(decoder.decode(decrypted));
            // Basic existence validation
            const requiredFields = ["twilioPhoneNumberFrom", "twilioPhoneNumberTo", "twilioAccountSid", "twilioAuthToken"];
            if (!requiredFields.every(f => typeof twilioEnvs[f] === "string"))
                return "Decrypted Twilio config is incomplete";
            return twilioEnvs;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during decryption.";
            return `Decryption failed: ${errorMessage}`;
        }
    }
    return "This function must be run on the server.";
}
const handler = async (event) => {
    if (!NEXT_PUBLIC_PRODUCTION_URL || !NEXT_PUBLIC_PRODUCTION_AUTH_URL) {
        return {
            statusCode: 400,
            error: `const NEXT_PUBLIC_PRODUCTION_URL or const NEXT_PUBLIC_PRODUCTION_AUTH_URL missing`,
        };
    }
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    // 📁 Works because CommonJS has __dirname by default
    const filePath = path_1.default.join(__dirname, "freeEmailList.txt");
    const freeEmailDomains = (0, fs_1.readFileSync)(filePath, "utf-8")
        .split("\n")
        .map(domain => domain.trim().toLowerCase())
        .filter(Boolean); // remove empty lines
    const imports = {
        Redis: ioredis_1.Redis,
        GetObjectCommand: client_s3_1.GetObjectCommand,
        DeleteObjectCommand: client_s3_1.DeleteObjectCommand,
        S3Client: client_s3_1.S3Client,
        DeleteScheduleCommand: client_scheduler_1.DeleteScheduleCommand,
        SchedulerClient: client_scheduler_1.SchedulerClient,
        SESClient: client_ses_1.SESClient, SendEmailCommand: client_ses_1.SendEmailCommand,
        createClient: supabase_js_1.createClient,
        simpleParser,
        nanoid: nanoid_1.nanoid,
        crypto: crypto_1.default,
        moment: moment_timezone_1.default,
        encoder,
        decoder,
        freeEmailDomains,
        setTimeout,
        Buffer: buffer_1.Buffer,
        URLSearchParams: // required for twilio Authorization token
        url_1.URLSearchParams,
        PusherServer: pusher_1.default,
        decryptDiscordWebhookUrl,
        decryptTelegramEnvs,
        decryptTwilioEnvs
    };
    const response = await fetch(`${NEXT_PUBLIC_PRODUCTION_AUTH_URL}api/lambda/VM-receiveEmails`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": NEXT_PUBLIC_PRODUCTION_URL
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
    // Make sure that responseData.code it's a index.js file that comes as a result of "tsc" command with "ESNext" in tsconfig.json
    const transformedCode = responseData.code
        // Remove the export handler function line, adjusting to potentially varying spaces
        .replace("export const handler = async (event) => {", '') // Remove handler definition line
        .replace(/\};\s*$/, ""); // Remove only the last closing `};`
    const wrappedCode = `  
      const { 
        Redis,
        GetObjectCommand,
        DeleteObjectCommand,
        S3Client,
        DeleteScheduleCommand,
        SchedulerClient,
        SESClient, SendEmailCommand,
        createClient,
        simpleParser,
        nanoid,
        crypto,
        encoder,
        decoder,
        moment,
        freeEmailDomains,
        setTimeout,
        Buffer,
        URLSearchParams,
        PusherServer,
        decryptDiscordWebhookUrl,
        decryptTelegramEnvs,
        decryptTwilioEnvs
      } = imports;

      (async () => {
          const response = await (async () => { 
            ${transformedCode} 
          })();
          return response
      })();
    `;
    // Execute the wrapped code in the VM
    // Updated 30.11.2025 - this is correct stable version
    const vm2Resp = await vm.run(wrappedCode);
    return {
        statusCode: vm2Resp.statusCode || 500,
        body: vm2Resp
    };
};
exports.handler = handler;
