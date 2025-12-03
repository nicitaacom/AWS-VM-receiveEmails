import VMModule from 'vm2';
const { VM } = VMModule;



import { Redis } from "ioredis";
import { GetObjectCommand, DeleteObjectCommand,S3Client } from "@aws-sdk/client-s3"
import { DeleteScheduleCommand, SchedulerClient } from "@aws-sdk/client-scheduler"
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"

import { createClient } from "@supabase/supabase-js"


import simpleParserModule from 'mailparser';
const { simpleParser } = simpleParserModule;

import moment from "moment-timezone"
import { nanoid } from 'nanoid';
import { Buffer } from "buffer"
import { URLSearchParams } from "url"
import crypto from "crypto"

import { readFileSync } from "fs"
import path from "path"











// DO NOT use this function in VM - for some reason it work with smth else but doesn't work with redis
async function decryptDiscordWebhookUrl(encryptedDiscordWebhookUrl: string): Promise<[string] | string> {
  if (typeof window === "undefined") {
    try {
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()

      // Define the secret key - mock data
      const secretKey = JSON.stringify({
        provider: ["supabase", "lambda", "discord"],
        APIKey: "replace-with-your-api-key",
      })

      // Convert the Base64-encoded string back to a Uint8Array
      const combined = Buffer.from(encryptedDiscordWebhookUrl, "base64")

      // Extract salt, IV, and ciphertext from the combined array
      const salt = Uint8Array.from(combined.slice(0, 16))
      const iv = combined.slice(16, 28)
      const ciphertext = combined.slice(28)

      // Create key material for PBKDF2
      const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, [
        "deriveKey",
      ])

      // Derive the decryption key using PBKDF2
      const key = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 328,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      )

      // Decrypt the ciphertext
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)

      // Return the decrypted plaintext as a string
      return [decoder.decode(decrypted)]
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during decryption."
      return `Decryption failed: ${errorMessage}`
    }
  }
  return "This function must be run on the server."
}

















// DO NOT use this function in VM - for some reason it work with smth else but doesn't work with redis

interface TelegramEnvs {
  telegramBotToken: string
  telegramChatId: string
}

export async function decryptTelegramEnvs(encryptedBase64: string): Promise<TelegramEnvs | string> {
  if (typeof window === "undefined") {
    try {
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()
      const secretKey = JSON.stringify({ provider: ["redis", "lambda", "telegram"] })

      const encryptedBytes = Buffer.from(encryptedBase64, "base64")

      const salt = encryptedBytes.slice(0, 16)
      const iv = encryptedBytes.slice(16, 28)
      const ciphertext = encryptedBytes.slice(28)

      const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, [
        "deriveKey",
      ])

      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 328, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      )

      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)

      const json = decoder.decode(decrypted)
      const data = JSON.parse(json)

      const telegramBotToken = data.telegramBotToken
      const telegramChatId = data.telegramChatId

      // === FINAL VALIDATION ===
      if (typeof telegramBotToken !== "string" || telegramBotToken.trim() === "") return "Invalid telegramBotToken"
      if (typeof telegramChatId !== "string" || telegramChatId.trim() === "") return "Invalid telegramChatId"

      return { telegramBotToken, telegramChatId }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `Decryption failed: ${message}`
    }
  }
  return "This function must be run on the server."
}













interface TwilioEnvs {
  twilioPhoneNumberFrom?: string
  twilioPhoneNumberTo?: string
  twilioAccountSid?: string
  twilioAuthToken?: string
}

// DO NOT use this function in VM - for some reason it work with smth else but doesn't work with redis
// I tried to change environment from node 22 to node 20 and ask chatGPT - useless
async function decryptTwilioEnvs(encryptedBase64: string): Promise<TwilioEnvs | string> {
  if (typeof window === "undefined") {
    try {
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()

      // Define the secret key - mock data
      const secretKey = JSON.stringify({
        provider: ["redis", "lambda", "twilio"],
        APIKey: "replace-with-your-api-key",
      })

      // Convert the Base64-encoded string back to a Uint8Array
      const combined = Buffer.from(encryptedBase64, "base64")

      // Extract salt, IV, and ciphertext from the combined array
      const salt = Uint8Array.from(combined.slice(0, 16))
      const iv = combined.slice(16, 28)
      const ciphertext = combined.slice(28)

      // Create key material for PBKDF2
      const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, [
        "deriveKey",
      ])

      // Derive the decryption key using PBKDF2
      const key = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 328,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      )

      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)
      const twilioEnvs: TwilioEnvs = JSON.parse(decoder.decode(decrypted))

      // Basic existence validation
      const requiredFields = ["twilioPhoneNumberFrom", "twilioPhoneNumberTo", "twilioAccountSid", "twilioAuthToken"]
      if (!requiredFields.every(f => typeof twilioEnvs[f as keyof TwilioEnvs] === "string"))
        return "Decrypted Twilio config is incomplete"

      return twilioEnvs
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during decryption."
      return `Decryption failed: ${errorMessage}`
    }
  }
  return "This function must be run on the server."
}














export const handler = async (event: Event) => {

  if (!process.env.NEXT_PUBLIC_PRODUCTION_URL || !process.env.NEXT_PUBLIC_PRODUCTION_AUTH_URL) {
    return {
      statusCode: 400,
      error: 'NEXT_PUBLIC_PRODUCTION_URL or NEXT_PUBLIC_PRODUCTION_AUTH_URL missing',
    } 
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();




  // 📁 Works because CommonJS has __dirname by default
  const filePath = path.join(__dirname, "freeEmailList.txt")

  const freeEmailDomains = readFileSync(filePath, "utf-8")
    .split("\n")
    .map(domain => domain.trim().toLowerCase())
    .filter(Boolean) // remove empty lines

  

  const imports = {
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
    moment,
    encoder,
    decoder,
    freeEmailDomains,
    Buffer, // required for twilio Authorization token
    URLSearchParams,
    decryptDiscordWebhookUrl,
    decryptTelegramEnvs,
    decryptTwilioEnvs
  }










  const response = await fetch(`${process.env.NEXT_PUBLIC_PRODUCTION_AUTH_URL}api/lambda/VM-receiveEmails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": process.env.NEXT_PUBLIC_PRODUCTION_URL!, // Non-null assertion, validated above
    },
    cache: "no-cache", // Should be no cache to improve security
  });

  if (!response.ok) {
    const errorMessage = await response.text(); // Get the error message from the response body
    throw new Error(`Error ${response.status}: ${errorMessage || "Unknown error"}`);
  }

  const responseData = await response.json();


  const vm = new VM({
    timeout: 25000, // 25 seconds to prevent Lambda timeout
    sandbox: {
      process: {
        env: { ...process.env },
      },
      fetch, // Pass fetch to the sandbox
      event, // Pass the event to the VM sandbox
      imports
    },
  });


  
    // Make sure that responseData.code it's a index.js file that comes as a result of "tsc" command with "ESNext" in tsconfig.json
    const transformedCode = responseData.code
    // Remove the export handler function line, adjusting to potentially varying spaces
    .replace("export const handler = async (event) => {", '') // Remove handler definition line
    .replace("};", ''); // Remove only the last closing `};`




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
        Buffer,
        URLSearchParams,
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
    }
}