.PHONY: claude backend-dev backend-workers test type-check reset-db deploy deploy-frontend

claude:
	claude --dangerously-skip-permissions

setup:
	uv venv --python 3.12 && uv sync
# TODO: playwright install 
