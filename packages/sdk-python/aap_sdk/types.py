from dataclasses import dataclass, field
from typing import Dict, Any, Optional, Literal, List
from datetime import datetime, timezone
import uuid

EventType = Literal["llm", "retrieval", "tool", "generic"]
PolicyDecision = Literal["ALLOWED", "BLOCKED", "REQUIRES_APPROVAL"]

def current_iso_time() -> str:
    return datetime.now(timezone.utc).isoformat()

@dataclass
class SpanEvent:
    event_id: str
    trace_id: str
    span_id: str
    event_type: EventType
    started_at: str
    duration_ms: Optional[int] = None
    parent_span_id: Optional[str] = None
    session_id: Optional[str] = None
    agent_id: Optional[str] = None
    agent_version: Optional[str] = None
    environment: Optional[str] = None
    name: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    status: Literal["ok", "error"] = "ok"
    error_message: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    cost: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None
    payload_reference: Optional[str] = None
    schema_version: str = "1"

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "eventId": self.event_id,
            "traceId": self.trace_id,
            "spanId": self.span_id,
            "eventType": self.event_type,
            "startedAt": self.started_at,
            "schemaVersion": self.schema_version,
            "status": self.status,
        }
        if self.duration_ms is not None: d["durationMs"] = self.duration_ms
        if self.parent_span_id: d["parentSpanId"] = self.parent_span_id
        if self.session_id: d["sessionId"] = self.session_id
        if self.agent_id: d["agentId"] = self.agent_id
        if self.agent_version: d["agentVersion"] = self.agent_version
        if self.environment: d["environment"] = self.environment
        if self.name: d["name"] = self.name
        if self.provider: d["provider"] = self.provider
        if self.model: d["model"] = self.model
        if self.error_message: d["errorMessage"] = self.error_message
        if self.input_tokens is not None: d["inputTokens"] = self.input_tokens
        if self.output_tokens is not None: d["outputTokens"] = self.output_tokens
        if self.cost is not None: d["cost"] = self.cost
        if self.metadata: d["metadata"] = self.metadata
        if self.payload_reference: d["payloadReference"] = self.payload_reference
        return d

@dataclass
class PolicyCheckResult:
    allowed: bool
    decision: PolicyDecision
    reason: Optional[str] = None
    policy_id: Optional[str] = None
    approval_id: Optional[str] = None
