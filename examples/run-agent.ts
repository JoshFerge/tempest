import { testWriterAgent } from '../src/lib/agent.js'
import { config } from 'dotenv'

// Load environment variables from .env file
config()

async function main() {
  await testWriterAgent('localhost:8080', 'play and have x win.')
}

main().catch(console.error)
