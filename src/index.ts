#!/usr/bin/env node

import { testWriterAgent } from "./lib/agent.js";
import * as process from "process";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: npx tempest <url> <instructions>");
    console.error("Example: npx tempest localhost:8080 'play and have x win.'");
    process.exit(1);
  }

  const [url, instructions] = args;
  
  try {
    await testWriterAgent(url, instructions);
  } catch (error) {
    console.error("Error running test writer agent:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});