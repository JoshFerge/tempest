from enum import StrEnum
from agents import Agent, Runner, function_tool

from pydantic import BaseModel

from tempest.harness import run_test
import logging

logger = logging.getLogger(__name__)


class OpenAIModel(StrEnum):
    GPT_4_1 = "gpt-4.1"
    GPT_4_1_MINI = "gpt-4.1-mini"
    GPT_4_1_NANO = "gpt-4.1-nano"
    GPT_5 = "gpt-5"
    GPT_5_MINI = "gpt-5-mini"


PLAYWRIGHT_ALLOWED_TOOLS = [
    "browser_close",
    "browser_wait",
    "browser_resize",
    "browser_console_messages",
    "browser_handle_dialog",
    "browser_press_key",
    "browser_navigate",
    "browser_navigate_back",
    "browser_navigate_forward",
    "browser_network_requests",
    "browser_snapshot",
    "browser_click",
    "browser_drag",
    "browser_hover",
    "browser_type",
    "browser_select_option",
    # "browser_take_screenshot",
    "browser_tab_list",
    "browser_tab_new",
    "browser_tab_select",
    "browser_tab_close",
]


class TestStep(BaseModel):
    step_number: int
    action: str
    target_element: str | None = None
    input_data: str | None = None
    expected_result: str
    notes: str | None = None


class TestOutput(BaseModel):
    success: bool
    failure_output: str | None


@function_tool()
async def run_test_tool(test_name: str, test_code: str) -> TestOutput:
    """
    test_code should be written like:
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

    async def test_login_and_add_task(ctx):
        page, expect, re, uuid = ctx.page, ctx.expect, ctx.re, ctx.uuid

        print("Launching Chromium browser (headless=True)...")

        await page.goto("https://cherish-app.com")
        await page.get_by_role("link", name=re.compile(r"sign in", re.I)).click()
        await expect(page).to_have_url("https://cherish-app.com/login")

        await page.get_by_label(re.compile(r"email", re.I)).fill("test@test.com")
        await page.get_by_label(re.compile(r"password", re.I)).fill("password")
        await page.get_by_role("button", name=re.compile(r"^\\s*log in\\s*$", re.I)).click()
        await expect(page).to_have_url("https://cherish-app.com/home")

        await page.get_by_role("link", name=re.compile(r"tasks", re.I)).click()

        task_name = f"TEST TASK {uuid.uuid4().hex[:8]}"
        await page.get_by_label(re.compile(r"title", re.I)).fill(task_name)
        await page.get_by_role("button", name=re.compile(r"^\\s*add task\\s*$", re.I)).click()

        row = page.locator(f"a:has-text('{task_name}')")  # fallback when no good label/role
        await expect(row).to_be_visible()
        await row.click()

        # Fallback to locator where label is broken
        desc = page.locator("#description-textarea")
        await desc.fill(f"This is a description for {task_name} (auto).")

        await page.get_by_role("button", name=re.compile(r"^\\s*update todo\\s*$", re.I)).click()
        await expect(page).to_have_url("https://cherish-app.com/todos")

        # Optional: force a failure to exercise artifacts
        await expect(page.locator("fail")).to_be_visible()
    """
    try:
        await run_test(
            "",
            test_code,
            headless=False,
            debug_stdout=True,
        )
    except Exception as e:
        output = str(e)
        if hasattr(e, "dom_snapshot"):
            output += f"\n\nDOM SNAPSHOT:\n{getattr(e, 'dom_snapshot')}"
        if hasattr(e, "accessibility_snapshot"):
            output += f"\n\nACCESSIBILITY SNAPSHOT:\n{getattr(e, 'accessibility_snapshot')}"
        # dom_snapshot = getattr(e, "dom_snapshot", None)
        # if dom_snapshot:
        #     print(f"\n{'=' * 80}")
        #     print("DOM SNAPSHOT AT FAILURE:")
        #     print(f"{'=' * 80}")
        #     print(dom_snapshot)
        #     print(f"{'=' * 80}")
        #     print("END DOM SNAPSHOT")
        #     print(f"{'=' * 80}\n")
        return TestOutput(success=False, failure_output=output)

    return TestOutput(success=True, failure_output=None)


async def test_writer_agent(url: str, instructions: str):
    prompt = f"""
    You are writing an E2E test. The user has provided a spec for what the test should do.
    after each action you take in the browser, you should update the test you're writing and run it.
    if you feel confident, you can write multiple steps at once.

    You have playwright MCP and you should use it to explore the pages you're writing tests for.
    use the run_test_tool to run the test you're writing. make sure to run the test before returning.

    user spec for the test: {instructions}

    you need to write the tests so that it satisfies the user spec. if it doesn't, you should keep writing the test until it does.
    you should not stop writing the test until it satisfies the user spec.

    You cannot return a failing test! Keep writing the test until it passes.

    when you've got a step of the test working, emit the steps so far to the user with the emit_steps tool.
    
    """

    @function_tool()
    async def emit_steps(test_steps: list[TestStep]) -> None:
        """
        emit a step in the test.
        """
        print(test_steps)

    class E2ETestSpec(BaseModel):
        test_name: str
        test_description: str
        target_url: str
        test_steps: list[TestStep]
        async_python_playwright_test_code: str

    smoke_test_agent = Agent(
        name="E2E Test Writer",
        instructions=prompt,
        model=OpenAIModel.GPT_4_1,
        tools=[run_test_tool, emit_steps],
        output_type=E2ETestSpec,
        # model_settings=ModelSettings(tool_choice="run_test_tool"),
    )
    result = await Runner.run(smoke_test_agent, url, max_turns=20)

    # Format and print the result nicely
    if hasattr(result, "final_output") and result.final_output:
        print("=" * 80)
        print("E2E TEST SPECIFICATION")
        print("=" * 80)
        print(f"Test Name: {result.final_output.test_name}")
        print(f"Test Description: {result.final_output.test_description}")
        print(f"Target URL: {result.final_output.target_url}")
        print("\n" + "=" * 80)
        print("PLAYWRIGHT TEST CODE")
        print("=" * 80)
        print(result.final_output.async_python_playwright_test_code)
        print("=" * 80)
        print("TEST STEPS")
        print("=" * 80)
        for i, step in enumerate(result.final_output.test_steps, 1):
            print(f"{i}. {step}")
        print("=" * 80)
    else:
        print("No final output available")

    return result.final_output
