import httpx
from typing import Optional, Dict, Any
from .types import PolicyCheckResult

def check_tool_policy(
    api_url: str,
    api_key: str,
    tool_name: str,
    environment: str = "production",
    parameters: Optional[Dict[str, Any]] = None,
) -> PolicyCheckResult:
    """
    Synchronous policy check helper for Python tool execution logic.
    Queries POST /policy-checks with Authorization: Bearer <api_key>.
    """
    url = f"{api_url.rstrip('/')}/policy-checks"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "toolName": tool_name,
        "environment": environment,
        "parameters": parameters,
    }

    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(url, headers=headers, json=payload)

        if resp.status_code not in (200, 201):
            return PolicyCheckResult(
                allowed=True,
                decision="ALLOWED",
                reason=f"Default allow on policy check error status {resp.status_code}",
            )

        data = resp.json()
        outcome = data.get("outcome", "ALLOWED")
        reason = data.get("reason")
        policy_id = data.get("policyId")
        approval_id = data.get("approvalId")

        if outcome == "DENIED":
            return PolicyCheckResult(
                allowed=False,
                decision="BLOCKED",
                reason=reason,
                policy_id=policy_id,
                approval_id=approval_id,
            )

        if outcome == "REQUIRES_APPROVAL":
            return PolicyCheckResult(
                allowed=False,
                decision="REQUIRES_APPROVAL",
                reason=reason,
                policy_id=policy_id,
                approval_id=approval_id,
            )

        return PolicyCheckResult(
            allowed=True,
            decision="ALLOWED",
            reason=reason,
            policy_id=policy_id,
            approval_id=approval_id,
        )
    except Exception as err:
        return PolicyCheckResult(
            allowed=True,
            decision="ALLOWED",
            reason=f"Fallback allow on policy check exception: {str(err)}",
        )
