import { testWriterAgent } from "../src/lib/agent";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

async function main() {
  await testWriterAgent(
    "localhost:8080",
    "play and have x win."
  );
}

main().catch(console.error);