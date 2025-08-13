import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { runTest } from "./harness.js";
import { 
  OpenAIModel, 
  E2ETestSpec 
} from "../types/index.js";
import * as fs from "fs/promises";
import * as path from "path";

const TestStepSchema = z.object({
  step_number: z.number(),
  action: z.string(),
  target_element: z.string().nullable().optional(),
  input_data: z.string().nullable().optional(),
  expected_result: z.string(),
  notes: z.string().nullable().optional(),
});


const E2ETestSpecSchema = z.object({
  test_name: z.string(),
  test_description: z.string(),
  target_url: z.string(),
  test_steps: z.array(TestStepSchema),
  async_playwright_test_code: z.string(),
});

const runTestTool = tool({
  name: "run_test_tool",
  description: "Run a Playwright test",
  parameters: z.object({
    test_name: z.string(),
    test_code: z.string(),
  }),
  async execute({ test_code }) {
    try {
      await runTest("", test_code, {
        headless: false,
        debugStdout: true,
      });
      return { success: true, failure_output: null };
    } catch (e) {
      const error = e as Error & { dom_snapshot?: string; accessibility_snapshot?: string };
      let output = String(error);
      if (error.dom_snapshot) {
        output += `\n\nDOM SNAPSHOT:\n${error.dom_snapshot}`;
      }
      if (error.accessibility_snapshot) {
        output += `\n\nACCESSIBILITY SNAPSHOT:\n${error.accessibility_snapshot}`;
      }
      return { success: false, failure_output: output };
    }
  }
});

const emitStepsTool = tool({
  name: "emit_steps",
  description: "Emit test steps to the user",
  parameters: z.object({
    test_steps: z.array(TestStepSchema),
  }),
  async execute({ test_steps }) {
    console.log("Test Steps:", test_steps);
    return { success: true };
  }
});

export async function testWriterAgent(
  url: string,
  instructions: string,
  save?: boolean
): Promise<E2ETestSpec | null> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  const prompt = `
    You are writing an E2E test. The user has provided a spec for what the test should do.
    after each action you take in the browser, you should update the test you're writing and run it.
    if you feel confident, you can write multiple steps at once.

    You have playwright MCP and you should use it to explore the pages you're writing tests for.
    use the run_test_tool to run the test you're writing. make sure to run the test before returning.

    user spec for the test: ${instructions}

    you need to write the tests so that it satisfies the user spec. if it doesn't, you should keep writing the test until it does.
    you should not stop writing the test until it satisfies the user spec.

    You cannot return a failing test! Keep writing the test until it passes.

    when you've got a step of the test working, emit the steps so far to the user with the emit_steps tool.
    
    Test code should be written like:
    # Locators are the recommended pattern because they make tests safer, clearer, and easier to maintain.
    # Prefer Playwright's expect(...) assertions (with auto-waiting) over manual wait_for_* + assert.
    # Make test data deterministic and unique (e.g., uuid4()), and consider cleanup.
    # Match URLs with globs/regex to reduce brittleness.
    # Don't double up wait_for_url and expect(...).to_have_url(...). Use expect—it already waits.
    # Don't use await page.wait_for_selector. Use expect(...).to_be_visible() instead.
    # Do not set custom timeouts anywhere. we'll rely on global settings
    # replace CSS with get_by_label where possible
    # prefer locator.fill to page.fill
    # prefer await page.get_by_role("button", name="Add Task").click()
    # to  await page.click("input[type='submit'][value='Add Task']")
    # prefer not to use page.locater. use page.get_by_label instead.

    #NOTE: you should not import anything. you are just writing the code in the function.
    # begin your code writing assuming you're right below the function definition. you'll have everything
    you need in ctx and playwright imports.

    async function test_login_and_add_task(ctx) {
        const { page, expect, re, uuid } = ctx;

        console.log("Launching Chromium browser (headless=True)...");

        await page.goto("https://cherish-app.com");
        await page.getByRole("link", { name: /sign in/i }).click();
        await expect(page).toHaveURL("https://cherish-app.com/login");

        await page.getByLabel(/email/i).fill("test@test.com");
        await page.getByLabel(/password/i).fill("password");
        await page.getByRole("button", { name: /^\\s*log in\\s*$/i }).click();
        await expect(page).toHaveURL("https://cherish-app.com/home");

        await page.getByRole("link", { name: /tasks/i }).click();

        const taskName = \`TEST TASK \${uuid.uuid4().toString().slice(0, 8)}\`;
        await page.getByLabel(/title/i).fill(taskName);
        await page.getByRole("button", { name: /^\\s*add task\\s*$/i }).click();

        const row = page.locator(\`a:has-text('\${taskName}')\`);  // fallback when no good label/role
        await expect(row).toBeVisible();
        await row.click();

        // Fallback to locator where label is broken
        const desc = page.locator("#description-textarea");
        await desc.fill(\`This is a description for \${taskName} (auto).\`);

        await page.getByRole("button", { name: /^\\s*update todo\\s*$/i }).click();
        await expect(page).toHaveURL("https://cherish-app.com/todos");

        // Optional: force a failure to exercise artifacts
        await expect(page.locator("fail")).toBeVisible();
    }
  `;

  const agent = new Agent({
    name: "E2E Test Writer",
    instructions: prompt,
    model: OpenAIModel.GPT_4_1 as string,
    tools: [runTestTool, emitStepsTool],
    outputType: E2ETestSpecSchema,
  });

  let result;
  try {
    // Pass the URL as the initial message to the agent
    result = await run(agent, url, { maxTurns: 20 });
  } catch (error) {
    console.error("Error running agent:", error);
    throw error;
  }

  let finalOutput: E2ETestSpec | null = null;
  
  // The run function returns a RunResult with the output
  if (result && typeof result === 'object') {
    // Check if result has a direct output or if it's wrapped in a state
    let output = (result as unknown as Record<string, unknown> & { state?: { _currentStep?: { output?: unknown } }; output?: unknown }).state?._currentStep?.output || (result as unknown as Record<string, unknown> & { output?: unknown }).output || result;
    
    // If output is a string, try to parse it as JSON
    if (typeof output === 'string') {
      try {
        output = JSON.parse(output);
      } catch {
        // Failed to parse as JSON, keep as is
      }
    }
    
    const parsed = E2ETestSpecSchema.safeParse(output);
    if (parsed.success) {
      finalOutput = parsed.data as E2ETestSpec;
    }
  }

  if (finalOutput) {
    console.log("=" + "=".repeat(79));
    console.log("E2E TEST SPECIFICATION");
    console.log("=" + "=".repeat(79));
    console.log(`Test Name: ${finalOutput.test_name}`);
    console.log(`Test Description: ${finalOutput.test_description}`);
    console.log(`Target URL: ${finalOutput.target_url}`);
    console.log("\n" + "=" + "=".repeat(79));
    console.log("PLAYWRIGHT TEST CODE");
    console.log("=" + "=".repeat(79));
    console.log(finalOutput.async_playwright_test_code);
    console.log("=" + "=".repeat(79));
    console.log("TEST STEPS");
    console.log("=" + "=".repeat(79));
    finalOutput.test_steps.forEach((step, i) => {
      console.log(`${i + 1}. ${JSON.stringify(step)}`);
    });
    console.log("=" + "=".repeat(79));
    
    if (save) {
      const tempestDir = path.join(process.cwd(), 'tempest');
      await fs.mkdir(tempestDir, { recursive: true });
      
      const sanitizedTestName = finalOutput.test_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const fileName = `${sanitizedTestName}.spec.ts`;
      const filePath = path.join(tempestDir, fileName);
      
      const testFileContent = finalOutput.async_playwright_test_code;
      
      await fs.writeFile(filePath, testFileContent, 'utf-8');
      console.log("\n" + "=".repeat(79));
      console.log(`Test saved to: ${filePath}`);
      console.log("=".repeat(79));
    }
  } else {
    console.log("No final output available");
  }

  return finalOutput;
}