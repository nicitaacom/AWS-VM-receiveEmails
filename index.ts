import VMModule from 'vm2';
const { VM } = VMModule;


import { Redis } from "ioredis";
import { GetObjectCommand, DeleteObjectCommand,S3Client } from "@aws-sdk/client-s3"
import { DeleteScheduleCommand, SchedulerClient, CreateScheduleCommand } from "@aws-sdk/client-scheduler"
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"

import { createClient } from "@supabase/supabase-js"
import PusherServer from "pusher"


import simpleParserModule from 'mailparser';
const { simpleParser } = simpleParserModule;

import moment from "moment-timezone"
import { nanoid } from 'nanoid';

// Node related
import { Buffer } from "buffer"
import { URLSearchParams } from "url"
import crypto from "crypto"

// For freeEmailDomains - so I fetch from entiryRedis envs by correct userId (if sent from gmail cuz user.email domain might be ukr.net)
import { readFileSync } from "fs"
import path from "path"




const NEXT_PUBLIC_PRODUCTION_URL = "https://www.outreach-tool.com/"
const NEXT_PUBLIC_PRODUCTION_AUTH_URL = "https://auth.outreach-tool.com/"


process.removeAllListeners("unhandledRejection")
process.on("unhandledRejection", (reason: any) => {
  const dump = {
    type: typeof reason,
    isError: reason instanceof Error,
    message: reason?.message,
    name: reason?.name,
    status: reason?.status,
    body: reason?.body,
    stack: reason?.stack,
    keys: reason && typeof reason === "object" ? Object.keys(reason) : [],
    str: String(reason),
  }
  console.log("[UNHANDLED_REJECTION]", JSON.stringify(dump))
})

console.log(52,'unhandledRejection registered')




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





export async function decryptAICredentialsFn(encryptedBase64: string): Promise<{ apiKey: string } | string> {
  if (typeof window === "undefined") {
    try {
      const encoder = new TextEncoder()

      const secretKey = JSON.stringify({
        secret: "redis+supabase",
        provider: "ai-credentials",
        APIKey: "example-here",
        route: "/",
        reason: "ai-manages-emails",
      })

      const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, [
        "deriveKey",
      ])

      const combined = new Uint8Array(Buffer.from(encryptedBase64, "base64"))
      const salt = combined.slice(0, 16)
      const iv = combined.slice(16, 28)
      const ciphertext = combined.slice(28)

      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      )

      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)
      const apiKey = JSON.parse(new TextDecoder().decode(decrypted)) as string
      return { apiKey }
    } catch (error) {
      return `Decryption failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  return "This function must be run on the server."
}





 // AES-GCM decrypt shared by both providers - same shape as decryptAICredentialsFn, secretKey per provider.
  // Mirrors outreach-tool app/classes/Envs/functions/public/decryptAutopilotVerificationEnvs*.ts EXACTLY
  // (salt 16 + iv 12 + ciphertext, PBKDF2 350000 SHA-256, AES-GCM 256).
  async function decryptAutopilotVerificationEnvs(encryptedStr:string, provider:'zerobounce' | 'verifalia') {
    try {

      const encryptionKey = provider === 'verifalia' ? '4a6842f9' : '50d7bcd2'

      const encoder = new TextEncoder()
      const decoder = new TextDecoder()
      const secretKey = JSON.stringify({
        secret: "redis",
        provider,
        APIKey: `verificationEnvs-${encryptionKey}`,
        route: "/",
        reason: "autopilot-verify-email",
      })

      const combined = Buffer.from(encryptedStr, "base64")
      const salt = Uint8Array.from(combined.slice(0, 16))
      const iv = combined.slice(16, 28)
      const ciphertext = combined.slice(28)

      const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, ["deriveKey"])
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 350000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      )
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)

      const decoded = JSON.parse(decoder.decode(decrypted))
      return Array.isArray(decoded) ? decoded : [decoded] // always an array of creds
    } catch (error) {
      return `Decryption failed (${provider}): ${error instanceof Error ? error.message : String(error)}`
    }
  }














export const handler = async (event: Event) => {

  if (!NEXT_PUBLIC_PRODUCTION_URL || !NEXT_PUBLIC_PRODUCTION_AUTH_URL) {
    return {
      statusCode: 400,
      error: `const NEXT_PUBLIC_PRODUCTION_URL or const NEXT_PUBLIC_PRODUCTION_AUTH_URL missing`,
    } 
  }


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
    CreateScheduleCommand, // for autoreplies (it schedule email)
    createClient,
    simpleParser,
    nanoid,
    moment,
    freeEmailDomains,
    PusherServer,
    decryptDiscordWebhookUrl,
    decryptTelegramEnvs,
    decryptTwilioEnvs,
    decryptAICredentialsFn,
    decryptAutopilotVerificationEnvs,
    AbortController,
    clearTimeout,
    crypto, // this project only related (to random id if idName already exist - case 2 times justSentEmail)
  }









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
    timeout: 120000, // 120 seconds to prevent Lambda timeout
    sandbox: {
      process: {
        env: { ...process.env },
      },
      // Node related
      setTimeout,
      Buffer, // required for twilio Authorization token
      URLSearchParams,
      fetch, // Pass fetch to the sandbox

      event, // Pass the event to the VM sandbox
      imports
    },
  });


  
    // Make sure that responseData.code it's a index.js file that comes as a result of "tsc" command with "ESNext" in tsconfig.json
    const transformedCode = responseData.code
    // Remove the export handler function line, adjusting to potentially varying spaces
    .replace("export const handler = async (event) => {", '') // Remove handler definition line
    .replace(/\};\s*$/, "")  // Remove only the last closing `};`

    // 1. extract ALL needed debug helpers with better regex
    const debugConstMatch = transformedCode.match(/const DEBUG_DISCORD_WEBHOOK_URL\s*=\s*"([^"]+)"/)
    const truncateMatch = transformedCode.match(/const truncateLongFields\s*=\s*\(errorMessage\)\s*=>\s*\{[\s\S]*?return JSON\.stringify\(parsed\)\s*\}/)
    const validateMatch = transformedCode.match(/const validateParsedError\s*=\s*\(parsed\)\s*=>\s*[\s\S]*?typeof parsed\.lambdaFnName === "string"/)
    const getErrorInfoMatch = transformedCode.match(/const getErrorInfo\s*=\s*\(errorMessage\)\s*=>\s*\{[\s\S]*?return \{ lambdaFnName, cause, formattedTime, processedMessage, parsingError \}\s*\}/)
    const sendFnMatch = transformedCode.match(/const sendDiscordDebugMessage\s*=\s*async\s*\(errorMessage\)\s*=>\s*\{[\s\S]*?return true\s*\}/)
    const getPartsFnMatch = transformedCode.match(/const getDiscordMessageParts\s*=\s*\(processedMessage,\s*headerLines(?:,\s*note)?\)\s*=>\s*\{[\s\S]*?return messageParts\s*\}/)


    const wrappedCode = `  
      const { 
        Redis,
        GetObjectCommand,
        DeleteObjectCommand,
        S3Client,
        DeleteScheduleCommand,
        SchedulerClient,
        SESClient, SendEmailCommand,
        CreateScheduleCommand,
        createClient,
        simpleParser,
        nanoid,
        crypto,
        moment,
        PusherServer,
        decryptDiscordWebhookUrl,
        decryptTelegramEnvs,
        decryptTwilioEnvs,
        freeEmailDomains,
        decryptAICredentialsFn,
        decryptAutopilotVerificationEnvs,
        clearTimeout,
        AbortController
      } = imports;

      (async () => {
          const response = await (async () => { 
            ${transformedCode} 
          })();
          return response
      })();
    `;
        
    


    // Execute the wrapped code in the VM
    // Updated 15.04.2026 - this is correct more stable version with debug is CV fail to execute
    return vm.run(wrappedCode)
    .then((vm2Resp:any) => ({ statusCode: vm2Resp.statusCode || 500, body: vm2Resp }))
    .catch(async (error: Error) => {
      const errMsg = error instanceof Error ? error.message : String(error)
      
      console.log("[VM CATCH] error type:", typeof error)
      console.log("[VM CATCH] error keys:", error && typeof error === "object" ? Object.keys(error) : "N/A")
      console.log("[VM CATCH] error stringified:", JSON.stringify(error, Object.getOwnPropertyNames(error || {})))
      console.log("[VM CATCH] error.message:", error?.message)
      console.log("[VM CATCH] error.stack:", error?.stack)
      console.log("[VM CATCH] error.cause:", (error as any)?.cause)
      
      if (debugConstMatch && truncateMatch && validateMatch && getErrorInfoMatch && sendFnMatch && getPartsFnMatch) {
        const debugCode = `
          ${debugConstMatch[0]};
          ${truncateMatch[0]};
          ${validateMatch[0]};
          ${getErrorInfoMatch[0]};
          ${sendFnMatch[0]};
          ${getPartsFnMatch[0]};
          await sendDiscordDebugMessage(\`VM runtime error in transformedCode: ${errMsg.replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)
        `
        try {
          await vm.run(`(async () => { ${debugCode} })()`)
        } catch (debugErr:unknown) {
          const debugMessage = debugErr instanceof Error ? debugErr.message : String(debugErr)
          console.log(250, 'debug send failed too:', debugMessage)
        }
      }

      return { statusCode: 500, body: { error: errMsg } }
    })
}