import VMModule from 'vm2';
const { VM } = VMModule;



import { Resend } from "resend"
import { Redis } from "ioredis";
import { GetObjectCommand, DeleteObjectCommand,S3Client } from "@aws-sdk/client-s3"
import { DeleteScheduleCommand, SchedulerClient } from "@aws-sdk/client-scheduler"
import { createClient } from "@supabase/supabase-js"


import simpleParserModule from 'mailparser';
const { simpleParser } = simpleParserModule;

import moment from "moment-timezone"
import { nanoid } from 'nanoid';
import { Buffer } from "buffer"
import { URLSearchParams } from "url"
import crypto from "crypto"






// DO NOT use this function in VM - for some reason it work with resend but doesn't work with redis
// I tried to change environment from node 22 to node 20 and ask chatGPT - useless
async function decryptResend(encryptedResendEnvValue:string) {
  try {
    // Define encoder and decoder - these were missing in your original code
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const secretKey = JSON.stringify({
      secret: "DB",
      provider: "resend",
      APIKey: "someAPIKeyHere",
    })

    // Decode base64 to Uint8Array
    const encryptedData = Buffer.from(encryptedResendEnvValue, "base64")

    // Extract the salt, iv, and encrypted content
    const salt = encryptedData.slice(0, 16)
    const iv = encryptedData.slice(16, 28)
    const encrypted = encryptedData.slice(28)

    const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, [
      "deriveKey",
    ])

    // Derive the key
    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 310,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    )

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, encrypted)

    // Parse the decrypted data as JSON to extract key-value object
    const decodedText = decoder.decode(decrypted)
    const result = JSON.parse(decodedText)

    // Ensure the object contains only key and value fields
    if (Object.keys(result).length !== 2 || !('key' in result) || !('value' in result)) {
      return "error: decrypted object must contain only key and value fields"
    }

    return { key: result.key, value: result.value }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during decryption."
    return `Decryption failed: ${errorMessage}`
  }
}





export const handler = async (event: Event) => {

  if (!process.env.NEXT_PUBLIC_PRODUCTION_URL || !process.env.NEXT_PUBLIC_PRODUCTION_AUTH_URL) {
   return {
    statusCode: 400,
    error: 'NEXT_PUBLIC_PRODUCTION_URL or NEXT_PUBLIC_PRODUCTION_AUTH_URL missing',
  } 
}




  const imports = {
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
    Buffer, // required for twilio Authorization token
    URLSearchParams,
    decryptResend
};










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
    Buffer,
    URLSearchParams,
    decryptResend} = imports;

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
    const cleanedError = result.body.replace(/\\n/g, "\n").replace(/\\/g, '').replace(/\\/g, '')
    throw new Error(cleanedError);
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
} catch (error) {
  
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