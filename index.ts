import VMModule from 'vm2';
const { VM } = VMModule;


import { Resend } from "resend"
import { Redis } from "ioredis";
import { GetObjectCommand, DeleteObjectCommand,S3Client } from "@aws-sdk/client-s3"
import { DeleteScheduleCommand } from "@aws-sdk/client-scheduler"
import { createClient } from "@supabase/supabase-js"


import simpleParserModule from 'mailparser';
const { simpleParser } = simpleParserModule;

import { nanoid } from 'nanoid';
import crypto from "crypto"




// Define the type for the event
interface Event {
  dateTime: string;
  message: string;
  channel: string;
  sendNotificationTo: string;
  inputNotificationTo: string;
}

type EventKeys = keyof Event;



function validateEvent(event: Event): void {
  const requiredFields: EventKeys[] = ['dateTime', 'message', 'sendNotificationTo'];
  for (const field of requiredFields) {
    if (!event[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}




export const handler = async (event: Event) => {


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
    console.log(94,errorMessage)
     return {
      statusCode: 400,
      body: JSON.stringify({ error: errorMessage }),
    };
    }
  });





  validateEvent(event);


  const imports = {
    Resend,
    Redis,
    GetObjectCommand,
    DeleteObjectCommand,
    S3Client,
    DeleteScheduleCommand,
    createClient,
    simpleParser,
    nanoid,
    crypto,
};











const response = await fetch(`${process.env.NEXT_PUBLIC_PRODUCTION_AUTH_URL}api/lambda/receiveEmails`, {
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
} catch (error) {
  const errorMessage: string = (error as Error)?.message || 'An unexpected error occurred';
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