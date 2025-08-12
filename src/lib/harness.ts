import { chromium, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { TestContext } from "../types";

const ARTIFACTS_DIR = path.join(process.cwd(), "results", "artifacts");

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

export async function runTest(
  name: string,
  testCode: string | ((ctx: TestContext) => Promise<void>),
  options: {
    headless?: boolean;
    debugStdout?: boolean;
  } = {}
): Promise<void> {
  const { headless = true, debugStdout = false } = options;

  let testFn: (ctx: TestContext) => Promise<void>;

  if (typeof testCode === "string") {
    const AsyncFunction = (async function () {}).constructor as any;
    const functionBody = testCode.replace(/^async\s+function\s+\w+\s*\([^)]*\)\s*{/, "")
      .replace(/}$/, "");
    testFn = new AsyncFunction("ctx", functionBody);
  } else {
    testFn = testCode;
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();

  const ctx: TestContext = {
    page,
    expect,
    re: RegExp,
    uuid: { uuid4: uuidv4 },
  };

  page.setDefaultTimeout(5000);

  if (debugStdout) {
    console.log(`Running test: ${name}`);
  }

  let status = "PASS";
  let error: Error | null = null;

  try {
    await testFn(ctx);
  } catch (e: any) {
    status = "FAIL";
    error = e;

    try {
      const html = await page.locator("body").innerHTML();
      const accessibility = await page.accessibility.snapshot();
      (e as any).dom_snapshot = html;
      (e as any).accessibility_snapshot = accessibility;
    } catch {
    }
  } finally {
    try {
      await context.tracing.stop();
    } catch {
    }
    await context.close();
    await browser.close();
  }

  if (debugStdout) {
    console.log(`[${status}] ${name}`);
  }

  if (error) {
    throw error;
  }
}