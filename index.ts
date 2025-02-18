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









export const handler = async (event: Event) => {

  if (!process.env.NEXT_PUBLIC_PRODUCTION_URL || !process.env.NEXT_PUBLIC_PRODUCTION_AUTH_URL) {
   return {
    statusCode: 400,
    error: 'NEXT_PUBLIC_PRODUCTION_URL or NEXT_PUBLIC_PRODUCTION_AUTH_URL missing',
  } 
}



  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

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
    encoder,
    decoder,
    Buffer, // required for twilio Authorization token
    URLSearchParams,
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