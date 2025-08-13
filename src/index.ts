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
  .command("test [filepath]", "Run a test file or all tests")
  .option("--all", "Run all tests in the tempest directory")
  .example("tempest test ./tempest/login-test.spec.ts")
  .example("tempest test ./my-test.js")
  .example("tempest test --all")
  .action(async (filepath: string | undefined, options: { all?: boolean }) => {
    try {
      // Handle --all flag
      if (options.all) {
        const tempestDir = path.join(process.cwd(), 'tempest');
        
        // Check if tempest directory exists
        try {
          await fs.access(tempestDir);
        } catch {
          console.error(`Error: tempest directory not found at ${tempestDir}`);
          process.exit(1);
        }
        
        // Get all test files in tempest directory
        const files = await fs.readdir(tempestDir);
        const testFiles = files.filter(file => file.endsWith('.spec.ts') || file.endsWith('.js'));
        
        if (testFiles.length === 0) {
          console.log("No test files found in tempest directory");
          return;
        }
        
        console.log("=" + "=".repeat(79));
        console.log(`RUNNING ALL TESTS (${testFiles.length} files)`);
        console.log("=" + "=".repeat(79));
        
        let passedCount = 0;
        let failedCount = 0;
        const failedTests: string[] = [];
        
        for (const testFile of testFiles) {
          const testPath = path.join(tempestDir, testFile);
          console.log(`\nRunning: ${testFile}`);
          console.log("-".repeat(80));
          
          try {
            const testCode = await fs.readFile(testPath, 'utf-8');
            await runTest(testFile, testCode, {
              headless: process.env.HEADLESS !== "false",
              debugStdout: true,
            });
            console.log(`✓ ${testFile} PASSED`);
            passedCount++;
          } catch (error) {
            console.error(`✗ ${testFile} FAILED`);
            console.error(`  Error: ${error}`);
            failedCount++;
            failedTests.push(testFile);
          }
        }
        
        // Summary
        console.log("\n" + "=" + "=".repeat(79));
        console.log("TEST SUMMARY");
        console.log("=" + "=".repeat(79));
        console.log(`Total: ${testFiles.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
        
        if (failedTests.length > 0) {
          console.log("\nFailed tests:");
          failedTests.forEach(test => console.log(`  - ${test}`));
          process.exit(1);
        } else {
          console.log("\nAll tests passed! ✓");
        }
        
        return;
      }
      
      // Handle single file test
      if (!filepath) {
        console.error("Error: Please provide a filepath or use --all flag");
        process.exit(1);
      }
      
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
      const testCode = await fs.readFile(resolvedPath, 'utf-8');
      
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