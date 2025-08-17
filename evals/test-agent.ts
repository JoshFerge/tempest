import { testWriterAgent } from '../src/lib/agent.js'
import * as dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

async function main() {
  console.log('Starting E2E Test Writer Agent...')
  console.log(
    'OPENAI_API_KEY is',
    process.env.OPENAI_API_KEY ? 'set' : 'not set'
  )

  try {
    const result = await testWriterAgent(
      'localhost:8080',
      'play and have x win.'
    )

    if (result) {
      console.log('\n✅ Test generation completed successfully!')
    } else {
      console.log('\n❌ Test generation failed - no output received')
    }
  } catch (error) {
    console.error('\n❌ Error running test writer agent:', error)
    process.exit(1)
  }
}

// Run the test
main().catch(error => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
