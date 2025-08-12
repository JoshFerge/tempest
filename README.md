# Tempest

Tempest is an AI agent that helps you write end-to-end tests using Playwright and the OpenAI Agents SDK.

## Features

- Automatically generates E2E tests based on your specifications
- Uses Playwright for browser automation
- Iteratively builds and tests the code until it passes
- Provides detailed test steps and complete test code
- Built with TypeScript and the OpenAI Agents SDK

## Prerequisites

- Node.js 18+ 
- An OpenAI API key

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

## Usage

### As a CLI tool

Run Tempest with a URL and test instructions:

```bash
npx tempest <url> <instructions>

# Example
npx tempest localhost:8080 "play tic-tac-toe and have X win"
```

### Programmatically

```typescript
import { testWriterAgent } from "tempest";

const result = await testWriterAgent(
  "localhost:8080",
  "play and have x win"
);
```

### Running the example

```bash
# Start your test server on localhost:8080
# Then run:
npm run test:agent
```

## Development

```bash
# Build the TypeScript code
npm run build

# Run in development mode with watch
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## How it Works

1. Tempest connects to your application URL
2. It analyzes the page structure using Playwright
3. It generates test code based on your instructions
4. It iteratively runs the test, fixing any issues until it passes
5. It outputs a complete E2E test specification with:
   - Test name and description
   - Step-by-step test actions
   - Complete Playwright test code

## License

MIT