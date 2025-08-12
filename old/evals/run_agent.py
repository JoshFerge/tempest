from tempest.agent import test_writer_agent
import asyncio

if __name__ == "__main__":
    asyncio.run(
        test_writer_agent(
            "localhost:8080",
            "play and have x win.",
        )
    )
