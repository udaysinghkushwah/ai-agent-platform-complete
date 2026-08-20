import functools
import inspect
from typing import Callable, Any, Optional
from .types import EventType, PolicyDecision
from .client import Trace

def trace_span(
    trace: Trace,
    event_type: EventType = "tool",
    name: Optional[str] = None,
    model: Optional[str] = None,
):
    """
    Python decorator to automatically instrument Python functions, LangChain tool functions,
    or LlamaIndex query handlers with platform telemetry spans.
    """
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        span_name = name or func.__name__

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            span = trace.start_span(event_type=event_type, name=span_name, model=model)
            try:
                result = func(*args, **kwargs)
                span.end(
                    status="ok",
                    metadata={
                        "func": func.__name__,
                        "args_count": len(args),
                        "kwargs_keys": list(kwargs.keys()),
                    },
                )
                return result
            except Exception as err:
                span.end(
                    status="error",
                    error_message=str(err),
                    metadata={"func": func.__name__},
                )
                raise

        return wrapper

    return decorator
