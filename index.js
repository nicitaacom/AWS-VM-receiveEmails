"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.decryptDiscordWebhookUrl = exports.decryptTelegramBotToken = exports.decryptTelegramChatId = void 0;
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
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
// DO NOT use this function in VM - for some reason it work with resend but doesn't work with redis
// I tried to change environment from node 22 to node 20 and ask chatGPT - useless
async function decryptResend(encryptedResendEnvValue) {
    try {
        // Define encoder and decoder - these were missing in your original code
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const secretKey = JSON.stringify({
            secret: "DB",
            provider: "resend",
            APIKey: "someAPIKeyHere",
        });
        // Decode base64 to Uint8Array
        const encryptedData = buffer_1.Buffer.from(encryptedResendEnvValue, "base64");
        // Extract the salt, iv, and encrypted content
        const salt = encryptedData.slice(0, 16);
        const iv = encryptedData.slice(16, 28);
        const encrypted = encryptedData.slice(28);
        const keyMaterial = await crypto_1.default.subtle.importKey("raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, [
            "deriveKey",
        ]);
        // Derive the key
        const key = await crypto_1.default.subtle.deriveKey({
            name: "PBKDF2",
            salt: salt,
            iterations: 310,
            hash: "SHA-256",
        }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
        // Decrypt the data
        const decrypted = await crypto_1.default.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, encrypted);
        // Parse the decrypted data as JSON to extract key-value object
        const decodedText = decoder.decode(decrypted);
        const result = JSON.parse(decodedText);
        // Ensure the object contains only key and value fields
        if (Object.keys(result).length !== 2 || !('key' in result) || !('value' in result)) {
            return "error: decrypted object must contain only key and value fields";
        }
        return { key: result.key, value: result.value };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during decryption.";
        return `Decryption failed: ${errorMessage}`;
    }
}
// DO NOT use this function in VM - for some reason it work with resend but doesn't work with redis
// I tried to change environment from node 22 to node 20 and ask chatGPT - useless
async function decryptTelegramChatId(encryptedTelegramChatId) {
    if (typeof window === "undefined") {
        try {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            // Define the secret key - mock data
            const secretKey = JSON.stringify({
                secret: "DB",
                provider: "redis",
                host: "AWS",
                APIKey: "replace-with-your-api-key",
            });
            // Convert the Base64-encoded string back to a Uint8Array
            const combined = buffer_1.Buffer.from(encryptedTelegramChatId, "base64");
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
                iterations: 300,
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
exports.decryptTelegramChatId = decryptTelegramChatId;
// DO NOT use this function in VM - for some reason it work with resend but doesn't work with redis
async function decryptTelegramBotToken(encryptedTelegramBotToken) {
    if (typeof window === "undefined") {
        try {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            // Define the secret key - mock data
            const secretKey = JSON.stringify({
                secret: "DB",
                provider: "redis",
                host: "AWS",
                APIKey: "replace-with-your-api-key",
            });
            // Convert the Base64-encoded string back to a Uint8Array
            const combined = buffer_1.Buffer.from(encryptedTelegramBotToken, "base64");
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
                iterations: 300,
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
exports.decryptTelegramBotToken = decryptTelegramBotToken;
async function decryptDiscordWebhookUrl(encryptedDiscordWebhookUrl) {
    if (typeof window === "undefined") {
        try {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            // Define the secret key - mock data
            const secretKey = JSON.stringify({
                provider: "redis",
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
exports.decryptDiscordWebhookUrl = decryptDiscordWebhookUrl;
const handler = async (event) => {
    if (!process.env.NEXT_PUBLIC_PRODUCTION_URL || !process.env.NEXT_PUBLIC_PRODUCTION_AUTH_URL) {
        return {
            statusCode: 400,
            error: 'NEXT_PUBLIC_PRODUCTION_URL or NEXT_PUBLIC_PRODUCTION_AUTH_URL missing',
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
        freeEmailDomains,
        Buffer: buffer_1.Buffer,
        URLSearchParams: // required for twilio Authorization token
        url_1.URLSearchParams,
        decryptResend,
        decryptTelegramChatId,
        decryptTelegramBotToken,
        decryptDiscordWebhookUrl
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
    encoder,
    decoder,
    moment,
    freeEmailDomains,
    Buffer,
    URLSearchParams,
    decryptResend, decryptTelegramChatId, decryptTelegramBotToken, decryptDiscordWebhookUrl} = imports;

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
