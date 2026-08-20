# @aap/sdk-python (`aap-sdk`)

Python SDK for the **AI Agent Reliability & Governance Platform**.

Provides asynchronous telemetry streaming, real-time tool governance policy checks, PII redaction integration, and `@trace_span` function instrumentation for LangChain, LlamaIndex, CrewAI, AutoGen, and custom Python AI agents.

---

## Installation

```bash
pip install aap-sdk
```

---

## Quickstart

```python
from aap_sdk import create_client, check_tool_policy, trace_span

# 1. Initialize platform client
client = create_client(
    api_key="your-platform-api-key",
    base_url="http://localhost:3000",
)

# 2. Start an agent execution trace
trace = client.start_trace(
    agent_id="python-customer-support-agent",
    environment="production",
)

# 3. LLM Planning Step
llm_span = trace.start_span(
    event_type="llm",
    name="generate-support-plan",
    provider="openai",
    model="gpt-4o",
)

# Simulate LLM inference
llm_span.end(
    status="ok",
    input_tokens=180,
    output_tokens=65,
    cost=0.0035,
    metadata={"prompt": "Assist customer with account update"},
)

# 4. Check Governance Policy before tool execution
policy_result = check_tool_policy(
    api_url="http://localhost:3000",
    api_key="your-platform-api-key",
    tool_name="update_user_email",
    environment="production",
    parameters={"email": "user@hospital.org"},
)

if not policy_result.allowed:
    print(f"Tool blocked by governance policy: {policy_result.reason}")
else:
    # 5. Instrumented Function Execution
    @trace_span(trace, event_type="tool", name="update_user_email")
    def update_email(email: str):
        return {"status": "updated", "email": email}

    res = update_email("user@hospital.org")

# Flush telemetry buffer before exit
client.shutdown()
```
