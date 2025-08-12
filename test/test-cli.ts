import { spawn } from "child_process";
import * as path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function testCLI() {
  console.log("Testing Tempest CLI...");
  console.log("OPENAI_API_KEY is", process.env.OPENAI_API_KEY ? "set" : "not set");

  return new Promise<void>((resolve, reject) => {
    // Path to the CLI entry point
    const cliPath = path.join(process.cwd(), "src", "index.ts");
    
    // Run the CLI with tsx
    const child = spawn("npx", ["tsx", cliPath, "localhost:8080", "play and have x win"], {
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output); // Print to console in real-time
    });

    child.stderr?.on("data", (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output); // Print errors to console
    });

    child.on("error", (error) => {
      console.error("❌ Failed to start CLI:", error);
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        // Check if the expected output is present
        if (stdout.includes("E2E TEST SPECIFICATION") && stdout.includes("TEST STEPS")) {
          console.log("\n✅ CLI test passed! Agent generated test successfully via CLI.");
          resolve();
        } else {
          console.error("\n❌ CLI test failed: Expected output not found");
          reject(new Error("Expected output not found in CLI response"));
        }
      } else {
        console.error(`\n❌ CLI test failed with exit code ${code}`);
        reject(new Error(`CLI exited with code ${code}`));
      }
    });
  });
}

// Run the test
testCLI().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});