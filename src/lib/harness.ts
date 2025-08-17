import { chromium, expect } from '@playwright/test'
import { v4 as uuidv4 } from 'uuid'
import { TestContext } from '../types/index.js'

export async function runTest(
  name: string,
  testCode: string | ((ctx: TestContext) => Promise<void>),
  options: {
    headless?: boolean
    debugStdout?: boolean
  } = {}
): Promise<void> {
  const { headless = true, debugStdout = false } = options

  let testFn: (ctx: TestContext) => Promise<void>

  if (typeof testCode === 'string') {
    const AsyncFunction = async function () {}.constructor as new (
      name: string,
      body: string
    ) => (ctx: TestContext) => Promise<void>
    const functionBody = testCode
      .replace(/^async\s+function\s+\w+\s*\([^)]*\)\s*{/, '')
      .replace(/}$/, '')
    testFn = new AsyncFunction('ctx', functionBody)
  } else {
    testFn = testCode
  }

  const browser = await chromium.launch({ headless })
  const context = await browser.newContext()
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  })
  const page = await context.newPage()

  const ctx: TestContext = {
    page,
    expect,
    re: RegExp,
    uuid: { uuid4: uuidv4 },
  }

  page.setDefaultTimeout(5000)

  if (debugStdout) {
    console.log(`Running test: ${name}`)
  }

  let status = 'PASS'
  let error: Error | null = null

  try {
    await testFn(ctx)
  } catch (e) {
    status = 'FAIL'
    error = e as Error

    try {
      const html = await page.locator('body').innerHTML()
      const accessibility = await page.accessibility.snapshot()
      ;(
        error as Error & {
          dom_snapshot?: string
          accessibility_snapshot?: unknown
        }
      ).dom_snapshot = html
      ;(
        error as Error & {
          dom_snapshot?: string
          accessibility_snapshot?: unknown
        }
      ).accessibility_snapshot = accessibility
    } catch {}
  } finally {
    try {
      await context.tracing.stop()
    } catch {}
    await context.close()
    await browser.close()
  }

  if (debugStdout) {
    console.log(`[${status}] ${name}`)
  }

  if (error) {
    throw error
  }
}
