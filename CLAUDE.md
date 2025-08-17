# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Top Level Instructions

- Do not commit unless i tell you to
- NEVER EVER PUSH TO MAIN WITHOUT ME GIVING YOU PERMISSION!

## Commands

### Development

```bash
npm run dev              # Run CLI in development mode with hot reload
npm run build            # Compile TypeScript to dist/
npm start                # Run compiled CLI from dist/
```

### Testing and Quality

```bash
npm test                 # Run Jest test suite
npm test -- --watch      # Run tests in watch mode
npm test -- path/to/test # Run specific test file
npm run typecheck        # Run TypeScript type checking
npm run lint             # Run ESLint
npm run eval             # Run evaluation scripts (test-agent.ts and test-cli.ts). DO NOT Run unless i tell you to
```

### CLI Usage

```bash
npx tempest <url> <instructions>   # Basic usage
npx tempest --help                  # Show help
npx tempest --version               # Show version

# Example
npx tempest localhost:8080 "click the login button and verify the dashboard loads"
```

## Architecture

### Core Components

**Agent System (`src/lib/agent.ts`)**

- Main `testWriterAgent` function orchestrates the AI-driven test generation
- Uses OpenAI Agents SDK with structured Zod schemas for type-safe outputs
- Implements iterative refinement loop (max 20 turns) until tests pass
- Tools: `RunTests` for execution, `emitTestStep` for progress tracking

**Test Harness (`src/lib/harness.ts`)**

- Executes generated Playwright tests in isolated browser contexts
- Captures DOM snapshots and accessibility data on failures for enhanced debugging
- Returns structured results with pass/fail status and error details
- Configurable headless/headed mode via `process.env.HEADLESS`

**CLI Interface (`src/index.ts`)**

- Uses CAC library for command parsing
- Entry point for the npm package
- Loads environment variables via dotenv

### Key Design Patterns

1. **Iterative Test Generation**: The agent repeatedly generates and tests code, incorporating failure feedback until success
2. **Structured AI Outputs**: Uses Zod schemas to ensure type-safe communication with the AI model
3. **Enhanced Error Context**: On test failures, captures full DOM and accessibility tree for better debugging
4. **Tool-based Architecture**: Leverages OpenAI Agents SDK tools for modular functionality

### Dependencies and Their Roles

- `@openai/agents`: Core AI orchestration and tool execution
- `@playwright/test`: Browser automation and E2E testing
- `zod`: Runtime type validation for AI outputs
- `cac`: CLI command parsing and help generation
- `uuid`: Unique test file naming

### Environment Variables

Required:

- `OPENAI_API_KEY`: Authentication for OpenAI API

Optional:

- `HEADLESS`: Set to "false" to run browser in headed mode for debugging

## Development Workflow

When modifying the agent logic:

1. The main agent prompt is in `src/lib/agent.ts` - it includes comprehensive Playwright best practices
2. Test generation follows structured output format defined by Zod schemas
3. The harness expects specific test function format: `async function testFunction(page: Page)`

When adding new CLI commands:

1. Update the CAC command definitions in `src/index.ts`
2. Export new functionality from `src/lib/agent.ts` for programmatic use
3. Update the package.json exports if adding new entry points

## Testing Approach

The project uses Jest for unit testing but primarily relies on evaluation scripts (`evals/`) for integration testing:

- `test-agent.ts`: Tests the agent's ability to generate working tests
- `test-cli.ts`: Validates CLI interface and argument parsing
