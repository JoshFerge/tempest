import dotenv from "dotenv";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";

// Load environment variables
dotenv.config();

async function testBasicAgent() {
  console.log("Testing basic agent functionality...");
  console.log("OPENAI_API_KEY is", process.env.OPENAI_API_KEY ? "set" : "not set");

  const simpleTool = tool({
    name: "simple_test",
    description: "A simple test tool",
    parameters: z.object({
      message: z.string(),
    }),
    async execute({ message }) {
      console.log("Tool executed with message:", message);
      return `Received: ${message}`;
    }
  });

  const agent = new Agent({
    name: "Test Agent",
    instructions: "You are a test agent. Use the simple_test tool to say hello.",
    model: "gpt-4o-mini",
    tools: [simpleTool],
  });

  try {
    const result = await run(agent, "Say hello!", { maxTurns: 20 });
    console.log("Agent result:", result);
    console.log("✅ Basic agent test passed!");
  } catch (error) {
    console.error("❌ Basic agent test failed:", error);
  }
}

testBasicAgent().catch(console.error);