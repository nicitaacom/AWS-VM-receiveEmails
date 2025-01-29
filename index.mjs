import { VM } from "vm2";
import { Resend } from "resend";
import { Redis } from "ioredis";
import { GetObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SchedulerClient,DeleteScheduleCommand } from "@aws-sdk/client-scheduler";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import crypto from "crypto";
import { simpleParser } from 'mailparser'

export const handler = async (event) => {
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
    "NEXT_PUBLIC_PRODUCTION_URL",
    "NEXT_PUBLIC_PRODUCTION_AUTH_URL",
  ];

  const missingEnv = requiredEnvVariables.find((variable) => !process.env[variable]);
  if (missingEnv) {
    const errorMessage = `Missing environment variable: ${missingEnv}`;
    console.error(errorMessage);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: errorMessage }),
    };
  }

  const imports = {
    Resend,
    Redis,
    GetObjectCommand,
    DeleteObjectCommand,
    DeleteScheduleCommand,
    SchedulerClient,
    S3Client,
    createClient,
    nanoid,
    simpleParser,
    crypto,
  };

  const response = await fetch(`${process.env.NEXT_PUBLIC_PRODUCTION_AUTH_URL}api/lambda/receiveEmails`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": process.env.NEXT_PUBLIC_PRODUCTION_URL },
    cache: "no-cache",
  });

  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(`Error ${response.status}: ${errorMessage || "Unknown error"}`);
  }

  const responseData = await response.json();
  const transformedCode = responseData.code
    .replace("export const handler = async (event) => {", "")
    .replace("};", "");



const decoder = new TextDecoder();
const encoder = new TextEncoder();

const wrappedCode = `
  const {
    Resend,
    Redis,
    GetObjectCommand,
    DeleteObjectCommand,
    DeleteScheduleCommand,
    S3Client,
    SchedulerClient,
    createClient,
    nanoid,
    crypto,
    simpleParser
  } = imports;

  (async () => {
    try {
      console.log("Executing handler logic...");
      const result = await (async () => { 
        ${transformedCode} 
      })();

      if (result.statusCode >= 400) {
        console.error("Handler returned an error:", result);
        throw new Error(JSON.stringify(result));
      }

      console.log("Handler logic executed successfully:", result);
      return result;
    } catch (err) {
      console.error("Error during execution:", err);
      throw err;
    }
  })();
`;

  // USE VM instead of NodeVM - this is important because otherwise async/await will not work
  const vm = new VM({
    timeout: 25000,
    compiler: "javascript",
    sandbox: {
      process: { env: process.env },
      fetch,
      imports,
      event,
      decoder,
      encoder
    },
  });

  try {
  const result = await vm.run(wrappedCode);
  if (result.statusCode >= 400) {
    // Handle errors: Fix newline formatting for better readability
    const formattedErrorBody = result.body.replace(/\\n/g, "\n").replace(/\\/g, '').replace(/\\/g, '');

    console.error(126,"Error in wrapped code execution:", formattedErrorBody);

    return {
      statusCode: result.statusCode,
      body: formattedErrorBody, // Return the error body with proper newlines
    };
  }

  console.log(134,"VM execution successful:\n", result);
  } catch (error) {
    const errorMessage = error.message.replace(/\\n/g, "\n").replace(/\\/g, '').replace(/\\/g, '')
    console.error("Error executing code in VM: ",errorMessage );
    return { statusCode: 500, body: errorMessage };
  }
};