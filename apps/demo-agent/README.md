# @aap/demo-agent (Integration Application)

Standalone sample application demonstrating complete integration with the **AI Agent Reliability & Governance Platform**.

## What it demonstrates

1. **Telemetry Instrumentation (`@aap/sdk-node`)**:
   - Starting traces (`startTrace`) for customer agent workflows.
   - Recording LLM inference spans (`eventType: 'llm'`) with input/output tokens and cost tracking.
   - Recording tool execution spans (`eventType: 'tool'`).
   - Flushing batched telemetry asynchronously to `POST /ingest`.

2. **Real-time Governance Policy Checks (`POST /policy-checks`)**:
   - Evaluating tool permissions before execution against governance rules.
   - Handling allowed vs. blocked tool decisions gracefully without crashing the agent.

3. **Dual Execution Modes**:
   - **HTTP Server**: Runs an Express REST API on `http://localhost:4000`.
   - **CLI Mode**: Runs standalone sample agent tasks from the command line.

## Quick Start

### 1. Run via Root NPM Workspace
From the repo root:

```bash
# Run HTTP server
npm --workspace=@aap/demo-agent run start

# Or run interactive CLI test
npm --workspace=@aap/demo-agent run run:cli
```

### 2. Triggering Agent Runs via HTTP API

```bash
# Trigger an agent run with tools
curl -X POST http://localhost:4000/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Find customer details and send confirmation email",
    "tools": ["user_search", "send_email"]
  }'
```

### 3. Check Status

```bash
curl http://localhost:4000/status
```
