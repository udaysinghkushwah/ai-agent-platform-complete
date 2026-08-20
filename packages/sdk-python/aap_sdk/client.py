import uuid
import time
import httpx
import threading
from typing import Optional, Dict, Any, List, Literal
from datetime import datetime, timezone
from .types import SpanEvent, EventType, current_iso_time

class SpanHandle:
    def __init__(
        self,
        client: "AapClient",
        trace_id: str,
        event_type: EventType,
        name: Optional[str] = None,
        parent_span_id: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        session_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        agent_version: Optional[str] = None,
        environment: Optional[str] = None,
    ):
        self.client = client
        self.trace_id = trace_id
        self.span_id = str(uuid.uuid4())
        self.event_type = event_type
        self.name = name
        self.parent_span_id = parent_span_id
        self.provider = provider
        self.model = model
        self.session_id = session_id
        self.agent_id = agent_id
        self.agent_version = agent_version
        self.environment = environment

        self.started_at_ms = int(time.time() * 1000)
        self.started_at_iso = current_iso_time()
        self._ended = False

    def end(
        self,
        status: Literal["ok", "error"] = "ok",
        error_message: Optional[str] = None,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
        cost: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
        payload_reference: Optional[str] = None,
    ) -> None:
        if self._ended:
            return
        self._ended = True

        duration_ms = int(time.time() * 1000) - self.started_at_ms

        event = SpanEvent(
            event_id=str(uuid.uuid4()),
            trace_id=self.trace_id,
            span_id=self.span_id,
            event_type=self.event_type,
            started_at=self.started_at_iso,
            duration_ms=duration_ms,
            parent_span_id=self.parent_span_id,
            session_id=self.session_id,
            agent_id=self.agent_id,
            agent_version=self.agent_version,
            environment=self.environment,
            name=self.name,
            provider=self.provider,
            model=self.model,
            status=status,
            error_message=error_message,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost=cost,
            metadata=metadata,
            payload_reference=payload_reference,
        )

        self.client._enqueue(event)

class Trace:
    def __init__(
        self,
        client: "AapClient",
        trace_id: str,
        session_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        agent_version: Optional[str] = None,
        environment: Optional[str] = None,
    ):
        self.client = client
        self.trace_id = trace_id
        self.session_id = session_id
        self.agent_id = agent_id
        self.agent_version = agent_version
        self.environment = environment

    def start_span(
        self,
        event_type: EventType,
        name: Optional[str] = None,
        parent_span_id: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> SpanHandle:
        return SpanHandle(
            client=self.client,
            trace_id=self.trace_id,
            event_type=event_type,
            name=name,
            parent_span_id=parent_span_id,
            provider=provider,
            model=model,
            session_id=self.session_id,
            agent_id=self.agent_id,
            agent_version=self.agent_version,
            environment=self.environment,
        )

class AapClient:
    def __init__(
        self,
        api_key: str,
        base_url: str = "http://localhost:3000",
        flush_interval_ms: int = 2000,
        batch_size: int = 10,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.flush_interval_sec = flush_interval_ms / 1000.0
        self.batch_size = batch_size

        self._buffer: List[SpanEvent] = []
        self._lock = threading.Lock()
        self._stop_event = threading.Event()

        self._worker_thread = threading.Thread(target=self._flush_loop, daemon=True)
        self._worker_thread.start()

    def start_trace(
        self,
        trace_id: Optional[str] = None,
        session_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        agent_version: Optional[str] = None,
        environment: Optional[str] = None,
    ) -> Trace:
        t_id = trace_id or str(uuid.uuid4())
        return Trace(
            client=self,
            trace_id=t_id,
            session_id=session_id,
            agent_id=agent_id,
            agent_version=agent_version,
            environment=environment,
        )

    def _enqueue(self, event: SpanEvent) -> None:
        with self._lock:
            self._buffer.append(event)
            if len(self._buffer) >= self.batch_size:
                self.flush()

    def flush(self) -> None:
        with self._lock:
            if not self._buffer:
                return
            to_send = self._buffer[:]
            self._buffer.clear()

        events_payload = [e.to_dict() for e in to_send]
        url = f"{self.base_url}/ingest"
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
        }

        try:
            with httpx.Client(timeout=5.0) as client:
                client.post(url, headers=headers, json={"events": events_payload})
        except Exception:
            pass  # silent swallow background flush errors

    def _flush_loop(self) -> None:
        while not self._stop_event.is_set():
            time.sleep(self.flush_interval_sec)
            self.flush()

    def shutdown(self) -> None:
        self._stop_event.set()
        self.flush()

def create_client(
    api_key: str,
    base_url: str = "http://localhost:3000",
    flush_interval_ms: int = 2000,
    batch_size: int = 10,
) -> AapClient:
    return AapClient(
        api_key=api_key,
        base_url=base_url,
        flush_interval_ms=flush_interval_ms,
        batch_size=batch_size,
    )
