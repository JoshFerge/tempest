#!/usr/bin/env node

import { cac } from "cac";
import { testWriterAgent } from "./lib/agent.js";
import { runTest } from "./lib/harness.js";
import * as dotenv from "dotenv";
import * as fs from "fs/promises";
import * as path from "path";

// Load environment variables from .env file
dotenv.config();

const cli = cac("tempest");

cli
  .command("create <url> <instructions>", "Generate end-to-end tests for a URL")
  .option("--save", "Save generated test to a tempest directory")
  .example("tempest create localhost:8080 'play and have x win.'")
  .example("tempest create localhost:8080 'click login' --save")
  .action(async (url: string, instructions: string, options: { save?: boolean }) => {
    try {
      await testWriterAgent(url, instructions, options.save);
    } catch (error) {
      console.error("Error running test writer agent:", error);
      process.exit(1);
    }
  });

cli
  .command("test <filepath>", "Run a test file")
  .example("tempest test ./tempest/login-test.spec.ts")
  .example("tempest test ./my-test.js")
  .action(async (filepath: string) => {
    try {
      // Resolve the file path
      const resolvedPath = path.resolve(filepath);
      
      // Check if file exists
      try {
        await fs.access(resolvedPath);
      } catch {
        console.error(`Error: File not found: ${resolvedPath}`);
        process.exit(1);
      }
      
      // Read the test file
      const fileContent = await fs.readFile(resolvedPath, 'utf-8');
      
      // Extract the test function from the file
      // Handle both raw test functions and Playwright test wrapper format
      let testCode: string;
      
      // Check if it's a Playwright test file with test() wrapper
      const playwrightTestMatch = fileContent.match(/test\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*async\s*\(\s*{\s*page\s*}\s*\)\s*=>\s*{([\s\S]*?)}\s*\)/);
      
      if (playwrightTestMatch) {
        // Extract the test name and body from Playwright test format
        const testName = playwrightTestMatch[1];
        testCode = playwrightTestMatch[2].trim();
        console.log(`Running test: "${testName}"`);
      } else {
        // Try to extract a raw async function
        const functionMatch = fileContent.match(/async\s+function\s+\w+\s*\([^)]*\)\s*{[\s\S]*}/);
        if (functionMatch) {
          testCode = functionMatch[0];
        } else {
          // Assume the entire file is the test code
          testCode = fileContent;
        }
      }
      
      console.log("=" + "=".repeat(79));
      console.log("RUNNING TEST FROM FILE");
      console.log("=" + "=".repeat(79));
      console.log(`File: ${resolvedPath}`);
      console.log("=" + "=".repeat(79));
      
      // Run the test through the harness
      await runTest(path.basename(filepath), testCode, {
        headless: process.env.HEADLESS !== "false",
        debugStdout: true,
      });
      
      console.log("\n" + "=" + "=".repeat(79));
      console.log("TEST PASSED ✓");
      console.log("=" + "=".repeat(79));
      
    } catch (error) {
      console.error("\n" + "=" + "=".repeat(79));
      console.error("TEST FAILED ✗");
      console.error("=" + "=".repeat(79));
      console.error("Error:", error);
      process.exit(1);
    }
  });

cli.help();
cli.version("0.0.1");

// Add default command to handle invalid usage
cli
  .command("[...args]", "Default handler", { allowUnknownOptions: true })
  .action((args) => {
    if (args && args.length > 0) {
      console.error(`Error: Invalid command or missing subcommand.`);
      console.error(`\nUsage:`);
      console.error(`  tempest create <url> <instructions>  - Generate a test`);
      console.error(`  tempest test <filepath>               - Run a test file`);
      console.error(`\nRun 'tempest --help' for more information.`);
      process.exit(1);
    }
  });

cli.parse();