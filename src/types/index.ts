export enum OpenAIModel {
  GPT_4_1 = 'gpt-4.1',
  GPT_4_1_MINI = 'gpt-4.1-mini',
  GPT_4_1_NANO = 'gpt-4.1-nano',
  GPT_5 = 'gpt-5',
  GPT_5_MINI = 'gpt-5-mini',
}

export const PLAYWRIGHT_ALLOWED_TOOLS = [
  'browser_close',
  'browser_wait',
  'browser_resize',
  'browser_console_messages',
  'browser_handle_dialog',
  'browser_press_key',
  'browser_navigate',
  'browser_navigate_back',
  'browser_navigate_forward',
  'browser_network_requests',
  'browser_snapshot',
  'browser_click',
  'browser_drag',
  'browser_hover',
  'browser_type',
  'browser_select_option',
  'browser_tab_list',
  'browser_tab_new',
  'browser_tab_select',
  'browser_tab_close',
] as const

export interface TestStep {
  step_number: number
  action: string
  target_element?: string | null
  input_data?: string | null
  expected_result: string
  notes?: string | null
}

export interface TestOutput {
  success: boolean
  failure_output?: string | null
}

export interface E2ETestSpec {
  test_name: string
  test_description: string
  target_url: string
  test_steps: TestStep[]
  async_playwright_test_code: string
}

import type { Page, expect } from '@playwright/test'

export interface TestContext {
  page: Page
  expect: typeof expect
  re: typeof RegExp
  uuid: { uuid4: () => string }
}
