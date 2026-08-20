"""
LangChain & LlamaIndex Callback Handlers for 1-line AI Agent Platform integration.
"""

from typing import Dict, Any, List, Optional
from .client import Trace, SpanHandle

class AapLangChainCallbackHandler:
    """
    LangChain BaseCallbackHandler for automatic instrumentation of LangChain agents.

    Usage:
        from aap_sdk.integrations import AapLangChainCallbackHandler
        handler = AapLangChainCallbackHandler(trace)
        llm = ChatOpenAI(callbacks=[handler])
    """

    def __init__(self, trace: Trace):
        self.trace = trace
        self._active_spans: Dict[str, SpanHandle] = {}

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], run_id: Any, **kwargs: Any) -> None:
        run_key = str(run_id)
        name = serialized.get("name") or "langchain-llm"
        model = serialized.get("kwargs", {}).get("model") or "llm"
        span = self.trace.start_span(event_type="llm", name=name, model=model)
        self._active_spans[run_key] = span

    def on_llm_end(self, response: Any, run_id: Any, **kwargs: Any) -> None:
        run_key = str(run_id)
        span = self._active_spans.pop(run_key, None)
        if not span:
            return

        token_usage = getattr(response, "llm_output", {}) or {}
        usage = token_usage.get("token_usage", {}) or {}

        span.end(
            status="ok",
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
            cost=usage.get("total_cost"),
        )

    def on_llm_error(self, error: BaseException, run_id: Any, **kwargs: Any) -> None:
        run_key = str(run_id)
        span = self._active_spans.pop(run_key, None)
        if span:
            span.end(status="error", error_message=str(error))

    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, run_id: Any, **kwargs: Any) -> None:
        run_key = str(run_id)
        name = serialized.get("name") or "langchain-tool"
        span = self.trace.start_span(event_type="tool", name=name)
        self._active_spans[run_key] = span

    def on_tool_end(self, output: str, run_id: Any, **kwargs: Any) -> None:
        run_key = str(run_id)
        span = self._active_spans.pop(run_key, None)
        if span:
            span.end(status="ok", metadata={"output": str(output)[:500]})

    def on_tool_error(self, error: BaseException, run_id: Any, **kwargs: Any) -> None:
        run_key = str(run_id)
        span = self._active_spans.pop(run_key, None)
        if span:
            span.end(status="error", error_message=str(error))
