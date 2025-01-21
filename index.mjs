import { VM } from "vm2";
import { Resend } from "resend";
import { Redis } from "ioredis";
import { GetObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DeleteScheduleCommand } from "@aws-sdk/client-scheduler";
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
    S3Client,
    DeleteScheduleCommand,
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
    S3Client,
    DeleteScheduleCommand,
    createClient,
    nanoid,
    crypto,
    simpleParser
  } = imports;

  (async () => {
    try {
      console.log("Executing handler logic...");
      await (async () => { 
        ${transformedCode} 
      })(); // Await the execution of tempCode
      console.log("Handler logic executed successfully.");
      return { success: true }; // Return a success object
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
    console.log("VM execution successful:", result);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error("Error executing code in VM:", error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};