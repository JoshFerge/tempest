#!/usr/bin/env node

import { cac } from "cac";
import { testWriterAgent } from "./lib/agent.js";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const cli = cac("tempest");

cli
  .command("<url> <instructions>", "Generate end-to-end tests for a URL")
  .example("tempest localhost:8080 'play and have x win.'")
  .action(async (url: string, instructions: string) => {
    try {
      await testWriterAgent(url, instructions);
    } catch (error) {
      console.error("Error running test writer agent:", error);
      process.exit(1);
    }
  });

cli.help();
cli.version("0.0.1");

cli.parse();