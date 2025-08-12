import asyncio
import re
from playwright.async_api import async_playwright, expect
import uuid

# Locators are the recommended pattern because they make tests safer, clearer, and easier to maintain.
# Prefer Playwright’s expect(...) assertions (with auto-waiting) over manual wait_for_* + assert.
# Make test data deterministic and unique (e.g., uuid4()), and consider cleanup.
# Match URLs with globs/regex to reduce brittleness.
# Don’t double up wait_for_url and expect(...).to_have_url(...). Use expect—it already waits.
# Don't use await page.wait_for_selector. Use expect(...).to_be_visible() instead.
# Do not set custom timeouts anywhere. we'll rely on global settings
# replace CSS with get_by_label where possible
# prefer locator.fill to page.fill
# prefer await page.get_by_role("button", name="Add Task").click()
# to  await page.click("input[type='submit'][value='Add Task']")
# prefer not to use page.locater. use page.get_by_label instead.


async def run():
    async with async_playwright() as p:
        print("Launching Chromium browser (headless=True)...")

        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        await context.tracing.start(screenshots=True, snapshots=True, sources=True)
        page = await context.new_page()

        try:
            await page.goto("https://cherish-app.com")
            await page.get_by_role("link", name=re.compile(r"sign in", re.I)).click()
            await expect(page).to_have_url("https://cherish-app.com/login")

            await page.get_by_label(re.compile(r"email", re.I)).fill(
                "jferg.biz.mail@gmail.com"
            )
            await page.get_by_label(re.compile(r"password", re.I)).fill("testtest")
            login_button = page.get_by_role(
                "button", name=re.compile(r"^\s*log in\s*$", re.I)
            )
            await login_button.click()

            await expect(page).to_have_url("https://cherish-app.com/home")

            await page.get_by_role("link", name=re.compile(r"tasks", re.I)).click()

            task_name = f"TEST TASK {uuid.uuid4().hex[:8]}"

            await page.get_by_label("title").fill(task_name)

            await page.get_by_role(
                "button", name=re.compile(r"^\s*add task\s*$", re.I)
            ).click()

            row = page.locator(f"a:has-text('{task_name}')")
            await expect(row).to_be_visible()
            await row.click()

            # have to fallback to locator because:
            """
            The label’s for="todo_description" doesn’t match the textarea’s id="description-textarea".
            Since there’s no association (and no aria-label/aria-labelledby),
            the textarea has no accessible name, so get_by_label(...)
            and get_by_role("textbox", name=...) won’t work.
            """
            desc = page.locator("#description-textarea")
            await desc.fill(
                f"This is a description for {task_name}. It was created automatically by the test script.",
            )

            await page.get_by_role(
                "button", name=re.compile(r"^\s*update todo\s*$", re.I)
            ).click()
            await expect(page).to_have_url("https://cherish-app.com/todos")
            await expect(page.locator("fail")).to_be_visible()

        except Exception as e:
            print(f"Test failed: {e}")
            # Get the current page HTML and output to console
            try:
                body_content = await page.locator("body").inner_html()
                print("\n" + "=" * 80)
                print("DOM SNAPSHOT AT FAILURE:")
                print("=" * 80)
                print(body_content)
                print("=" * 80)
                print("END DOM SNAPSHOT")
                print("=" * 80)
            except Exception as html_error:
                print(f"Could not capture HTML: {html_error}")

            # Stop tracing and save the trace
            await context.tracing.stop(path="test-trace.zip")
            print("Trace saved to test-trace.zip")
            print("To view the trace, run: playwright show-trace test-trace.zip")
            raise
        else:
            # stop and save trace on success too (or skip if you only want traces on fail)
            await context.tracing.stop(path="test-trace.zip")
        finally:
            await context.close()
            await browser.close()


if __name__ == "__main__":
    asyncio.run(run())
