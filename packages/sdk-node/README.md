# @aap/sdk-node

Official Node.js SDK for instrumenting AI agents against the **AI Agent Reliability, Telemetry & Governance Platform**. Requires Node 18+ (uses global `fetch`).

---

## 📦 Installation

```bash
npm install @aap/sdk-node
# or via yarn / pnpm
yarn add @aap/sdk-node
pnpm add @aap/sdk-node
```

---

## 🚀 Quick Start

```typescript
import { createClient } from '@aap/sdk-node';

// Initialize Client
const aap = createClient({
  apiKey: process.env.AAP_API_KEY!, // API key issued from Dashboard API Keys Settings
  baseUrl: 'http://localhost:3000', // Platform API Server URL
});

async function runCustomerAgent(userMessage: string) {
  // 1. Start agent execution trace
  const trace = aap.startTrace({
    agentId: 'support-bot',
    agentVersion: 'v2.1',
  });

  // 2. Instrument LLM call span
  const span = trace.startSpan({
    eventType: 'llm',
    name: 'draft-reply',
    provider: 'openai',
    model: 'gpt-4o',
  });

  try {
    const result = await callLLM(userMessage);

    // 3. Complete span with token metrics & cost
    span.end({
      status: 'ok',
      inputTokens: result.usage.prompt_tokens,
      outputTokens: result.usage.completion_tokens,
      cost: result.usage.estimated_cost,
    });

    return result.text;
  } catch (err: any) {
    span.end({
      status: 'error',
      errorMessage: err.message,
    });
    throw err;
  }
}

// Gracefully flush queued telemetry events before server shutdown
await aap.shutdown();
```

---

## ⚡ Architecture & Features

- **Non-Blocking Ingestion**: Spans are buffered in memory and dispatched in background batches (default: 20 events or 5 seconds) without adding network latency to your agent's response path.
- **Exponential Retry Backoff**: Failed sends retry up to 3 times with exponential backoff before logging dropped batches to prevent memory leaks.
- **Idempotent Operations**: `span.end()` is safe to call inside `finally` blocks, and client-generated `eventId` UUIDs prevent duplicate spans.
- **Governance Policy Checks**: Evaluate high-risk tool execution policies (`DENIED`, `REQUIRES_APPROVAL`) directly from the SDK.

---

## 📖 npm Publishing Setup

To publish this package to the npm registry under your account:

```bash
# 1. Compile TypeScript distribution
npm run build

# 2. Verify dry-run contents
npm publish --dry-run

# 3. Publish to live npm registry
npm publish --access public
```

---

## 📜 License
MIT License.
