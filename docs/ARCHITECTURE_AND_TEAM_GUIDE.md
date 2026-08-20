# 🏛️ AI Agent Reliability, Telemetry & Governance Platform
## Comprehensive Architecture, Tech Stack & Engineering Team Guide

This document provides a complete technical deep-dive into the architecture, technology stack, data flow pipelines, security guardrails, database schemas, and operational workflows of the **AI Agent Reliability & Governance Platform**. It is designed to onboard engineering teams, technical architects, and security auditors.

---

## 📐 1. Visual Platform Architecture

![Platform Architecture Diagram](/Users/uday/Documents/AI/ai-agent-platform-complete/docs/assets/images/architecture_diagram.png)

```mermaid
flowchart TB
    subgraph ClientLayer ["Agent Layer (Node.js & Python SDKs)"]
        NodeSDK["@aap/sdk-node"]
        PySDK["aap-sdk (Python)"]
        LangChain["LangChain / LlamaIndex"]
    end

    subgraph IngestionLayer ["Ingestion & Control Plane"]
        API["NestJS API Server (Port 3000)"]
        Auth["TenantGuard / Auth JWT"]
        Health["HealthController (/health)"]
    end

    subgraph AsyncWorkerLayer ["Queue & Async Processing"]
        Redis["Redis 7 (Pub/Sub & BullMQ)"]
        Worker["BullMQ Worker Processor"]
        RAGEval["RAG & LLM Evaluators"]
    end

    subgraph DataStorage ["Database & Storage"]
        Postgres[(PostgreSQL 16 Database)]
        Prisma["Prisma ORM (Schema & Seed)"]
    end

    subgraph PresentationLayer ["Observability Control Plane"]
        Dashboard["Next.js 14 Control Plane (Port 3001)"]
        Slack["Slack Block Kit Webhooks"]
        CLI["@aap/cli (CI/CD Regression Gate)"]
    end

    NodeSDK -->|POST /ingest (Async 202)| API
    PySDK -->|POST /ingest (Async 202)| API
    LangChain --> PySDK

    API -->|Enqueue Jobs| Redis
    Redis -->|Consume Jobs| Worker
    Worker -->|Upsert Traces & Spans| Postgres
    Worker -->|Publish Events| Redis

    API -->|Read/Write| Postgres
    Prisma -.-> Postgres

    Dashboard -->|REST / SSE Streaming| API
    Worker -->|HITL Approval Card| Slack
    CLI -->|POST /regression-checks| API
```

---

## 🖥️ 2. Control Plane Dashboard Visual Interface Walkthrough

``| Standard App View | Interactive Studio View |
|---|---|
| ![Alert Rules & HITL Safety Guardrails Queue](/Users/uday/Documents/AI/ai-agent-platform-complete/docs/assets/images/alerts_governance.png) | ![Connect Your Agent Onboarding & Telemetry SDK](/Users/uday/Documents/AI/ai-agent-platform-complete/docs/assets/images/onboarding_sdk.png) |

````carousel
![Alert Rules & HITL Safety Guardrails Queue](/Users/uday/Documents/AI/ai-agent-platform-complete/docs/assets/images/alerts_governance.png)
<!-- slide -->
![Connect Your Agent Onboarding & Telemetry SDK](/Users/uday/Documents/AI/ai-agent-platform-complete/docs/assets/images/onboarding_sdk.png)
<!-- slide -->
![AI Observability Dashboard Main Overview](/Users/uday/Documents/AI/ai-agent-platform-complete/docs/assets/images/dashboard_main.png)
<!-- slide -->
![Prompt Sandbox & Benchmark Studio](/Users/uday/Documents/AI/ai-agent-platform-complete/docs/assets/images/prompts_playground.png)
<!-- slide -->
![Slack Block Kit & Webhooks Integrations Channel](/Users/uday/Documents/AI/ai-agent-platform-complete/docs/assets/images/integrations_slack.png)
````

---

## 🛠️ 3. Comprehensive Tech Stack & Framework Breakdown

| Component | Framework / Library | Purpose & Rationale |
| :--- | :--- | :--- |
| **Control Plane API** | **NestJS 10 (TypeScript)** | Modular, enterprise Node.js framework providing dependency injection, route guards (`TenantGuard`), rate limiters (`ThrottlerModule`), and decorators. |
| **Observability Dashboard** | **Next.js 14 (App Router)** | Modern SSR/SPA framework with React 18, TailwindCSS, Glassmorphism design system, Lucide icons, and Framer Motion animations. |
| **Async Worker Queue** | **BullMQ 5 & ioredis** | High-performance Redis-backed job queue for background dataset evaluation, trace aggregations, and webhook notifications. |
| **Relational Database** | **PostgreSQL 16 & Prisma ORM** | ACID-compliant database for tenant organizations, projects, API keys, traces, spans, prompt versions, datasets, and audit logs. |
| **Cache & Pub/Sub** | **Redis 7 Alpine** | In-memory message broker powering Server-Sent Events (SSE) live trace streaming and BullMQ queue management. |
| **Node.js SDK** | **`@aap/sdk-node`** | Native TypeScript library featuring asynchronous batching, exponential retry backoffs, and non-blocking span delivery. |
| **Python SDK** | **`aap-sdk` (PyPI)** | Python package featuring `AapClient`, `@trace_span` decorator, `check_tool_policy`, and `AapLangChainCallbackHandler`. |
| **CI/CD Regression CLI** | **`@aap/cli`** | Command-line tool built with TypeScript & Commander.js for executing prompt regression suites in CI/CD pipelines. |
| **Containerization** | **Docker & Docker Compose** | Multi-stage Alpine container builds for seamless single-command production deployment (`docker compose up -d`). |

---

## 🔬 4. Deep-Dive into Subsystems & Modules

### 4.1 Ingestion & SSE Telemetry Streaming
- **Asynchronous Non-Blocking Route (`POST /ingest`)**: Validates project API keys via `ApiKeysService`, pushes span batches directly to the Redis BullMQ queue, and returns `202 Accepted` in under 5ms.
- **Worker Aggregations**: The BullMQ queue processor (`apps/worker/src/processor.ts`) drains queued span batches, creates or updates parent `Trace` records, calculates total token usage and USD costs, and writes idempotent `Span` records.
- **Server-Sent Events (`GET /projects/:projectId/traces/stream`)**: Subscribes to Redis Pub/Sub channels (`trace_updates:<projectId>`) and streams real-time updates directly to the Dashboard UI without browser polling.

### 4.2 Human-in-the-Loop (HITL) Governance Policy Engine
- **Policy Check Endpoint (`POST /policy-checks`)**: Evaluates incoming tool execution parameters against active project policies.
- **Execution Outcomes**:
  - `ALLOWED`: Execution proceeds immediately.
  - `DENIED`: Execution blocked with policy violation reason.
  - `REQUIRES_APPROVAL`: Execution paused. Generates a `PendingApproval` record, dispatches a Slack Block Kit interactive card, and alerts human reviewers in the `/alerts` queue.
- **Approval Resolution (`POST /projects/:projectId/approvals/:id/resolve`)**: Human admins approve or reject pending tool calls, unblocking or cancelling the agent workflow.

### 4.3 Interactive Prompt Sandbox & Benchmark Studio (`/prompts/playground`)
- Interactively test system persona instructions and prompt templates containing `{{variable_name}}` placeholders.
- Tune hyperparameters: LLM Engine (`GPT-4o`, `Claude 3.5 Sonnet`, `Llama 3 70B`), Temperature, Max Tokens.
- Evaluates real-time PII redaction (`[EMAIL_REDACTED]`, `[CARD_REDACTED]`) and prompt injection guardrails.
- Returns benchmark telemetry: **Safety Gate Status**, **Total Tokens**, **Estimated USD Cost**, and **Latency (ms)**.

### 4.4 RAG & LLM Quality Evaluators (`apps/worker/src/evaluators/rag.ts`)
- **Faithfulness (Groundedness)**: Verifies if generated claims are directly supported by retrieved context documents.
- **Context Relevance**: Measures noise-to-signal ratio in retrieved document chunks.
- **Answer Relevance**: Evaluates whether the generated response directly addresses the user query.
- **Recall@K & Ranking Quality**: Assesses document retrieval precision.

### 4.5 Natural Language Semantic Trace Engine
- **Semantic Search Endpoint (`GET /projects/:projectId/traces/search/query?q=<term>`)**: Allows engineers to search across millions of historical agent traces using natural language keywords, model names, user IDs, or error codes.

---

## 🗄️ 5. Data Model & Database Schema Design

```prisma
model Organization {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members      OrgMember[]
  projects     Project[]
  auditEvents  AuditEvent[]
}

model Project {
  id             String   @id @default(uuid())
  organizationId String
  name           String
  environment    String   @default("production") // development, staging, production
  webhookUrl     String?
  slackWebhookUrl String?

  apiKeys            ApiKey[]
  traces             Trace[]
  datasets           Dataset[]
  prompts            Prompt[]
  governancePolicies GovernancePolicy[]
  alertRules         AlertRule[]
}

model Trace {
  id           String   @id @default(uuid())
  projectId    String
  agentId      String
  agentVersion String?
  status       String   @default("ok") // ok, error
  totalTokens  Int      @default(0)
  costUSD      Float    @default(0)
  durationMs   Int      @default(0)
  startTime    DateTime @default(now())
  endTime      DateTime?

  spans        Span[]
}

model Span {
  id           String   @id @default(uuid())
  traceId      String
  eventId      String   @unique // Client UUID for idempotency
  name         String
  eventType    String   // llm, tool, chain, retrieval
  provider     String?  // openai, anthropic, custom
  model        String?  // gpt-4o, claude-3-5-sonnet
  inputTokens  Int      @default(0)
  outputTokens Int      @default(0)
  costUSD      Float    @default(0)
  status       String   @default("ok")
  errorMessage String?
  metadata     Json?
}

model PendingApproval {
  id           String   @id @default(uuid())
  projectId    String
  toolName     String
  environment  String
  reason       String
  requestedAt  DateTime @default(now())
  status       String   @default("PENDING") // PENDING, APPROVED, REJECTED
  resolvedBy   String?
  resolvedAt   DateTime?
}
```

---

## 🔒 6. Security, Compliance & Governance Controls

1. **Strict Multi-Tenant Isolation (`TenantGuard`)**: Every API endpoint validates caller organization and project scope, preventing cross-tenant data leaks.
2. **Hashed API Keys**: API keys are generated using cryptographically secure random bytes (`aap_live_...`). Only the key hash is stored at rest in PostgreSQL.
3. **PII Regex Redactor**: Interceptor redacting sensitive financial data, emails, and authorization keys (`[EMAIL_REDACTED]`, `[CARD_REDACTED]`, `[KEY_REDACTED]`).
4. **Immutable Audit Events & CSV Exporter**: All critical administrative mutations (API key creation, policy changes, approval decisions) are recorded in an append-only audit table with instant CSV export (`GET /organizations/:orgId/audit-events/export`).
5. **Health & Readiness Probes (`GET /health`)**: Live liveness and readiness check probe endpoints verifying PostgreSQL database and Redis status for Docker and Kubernetes clusters.

---

## 🚀 7. Step-by-Step Developer & Operations Guide

### 7.1 Running Locally with Node & Docker
```bash
# 1. Clone repository & install dependencies
git clone https://github.com/your-org/ai-agent-platform.git
cd ai-agent-platform
npm install

# 2. Start PostgreSQL and Redis containers
docker compose up -d postgres redis

# 3. Initialize Prisma schema & run migrations
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed

# 4. Launch development services
npm run start:api        # API Server on http://localhost:3000
npm run start:worker     # BullMQ Queue Worker Processor
npm run start:dashboard  # Control Plane Dashboard on http://localhost:3001
```

### 7.2 Deploying with Production Docker Compose
```bash
# Copy production environment variables
cp .env.production.example .env

# Build and start all multi-container services
docker compose up -d --build
```
