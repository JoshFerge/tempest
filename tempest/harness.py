# harness.py
import re
import uuid
import asyncio
from pathlib import Path
from datetime import datetime  # noqa: F401
from dataclasses import dataclass
from typing import Any, Union, Callable, Awaitable  # noqa: F401
from playwright.async_api import async_playwright, expect, Page, Expect

ARTIFACTS_DIR = Path("results/artifacts")
ARTIFACTS_DIR.mkdir(exist_ok=True)


@dataclass
class TestContext:
    page: Page
    expect: Expect
    re: Any
    uuid: Any


async def run_test(name: str, test_fn: Any, *, headless: bool = True, debug_stdout: bool = False):
    """Run a single Playwright test function with automatic tracing & artifacts.

    Args:
        name: Name of the test
        test_fn: Either a function that takes a TestContext, or a string containing Python code
        headless: Whether to run browser in headless mode
        debug_stdout: Whether to enable debug output
    """
    # If test_fn is a string, compile it into a function
    if isinstance(test_fn, str):
        # Execute the string code directly - it should contain the function definition
        namespace: dict[str, Any] = {}
        exec(test_fn, namespace)
        # Find the first async function in the namespace
        for name, obj in namespace.items():
            if callable(obj) and hasattr(obj, "__code__") and asyncio.iscoroutinefunction(obj):
                test_fn = obj
                break
        else:
            raise ValueError("No async function found in the provided string code")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context()
        await context.tracing.start(screenshots=True, snapshots=True, sources=True)
        page = await context.new_page()

        ctx = TestContext(page=page, expect=expect, re=re, uuid=uuid)
        page.set_default_timeout(5000)
        print(f"Running test: {name}")
        try:
            await test_fn(ctx)  # AI-written body goes here
            status = "PASS"
        except Exception as e:
            status = "FAIL"
            # Best-effort artifacts
            try:
                # Get both DOM and accessibility snapshots
                html = await page.locator("body").inner_html()
                accessibility_snapshot = await page.accessibility.snapshot()
                setattr(e, "dom_snapshot", html)
                setattr(e, "accessibility_snapshot", accessibility_snapshot)
            except Exception:
                pass

            finally:
                await context.close()
                await browser.close()
            print(f"[{status}] {name}")
            raise
        else:
            try:
                await context.tracing.stop()
            except Exception:
                pass
            finally:
                await context.close()
                await browser.close()
            print(f"[{status}] {name}")
