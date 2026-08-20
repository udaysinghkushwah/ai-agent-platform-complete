export interface PolicyCheckResult {
  allowed: boolean;
  decision: 'ALLOWED' | 'BLOCKED' | 'REQUIRES_APPROVAL';
  policyId?: string;
  approvalId?: string;
  reason?: string;
}

export async function checkToolPolicy(
  apiUrl: string,
  apiKey: string,
  toolName: string,
  environment: string = 'production',
  parameters?: Record<string, unknown>,
): Promise<PolicyCheckResult> {
  try {
    const res = await fetch(`${apiUrl}/policy-checks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        toolName,
        environment,
        parameters,
      }),
    });

    if (!res.ok) {
      console.warn(`[PolicyCheck] Check failed with status ${res.status}: ${await res.text()}`);
      return { allowed: true, decision: 'ALLOWED', reason: 'Default allow on policy check error' };
    }

    const data = (await res.json()) as {
      outcome: 'ALLOWED' | 'DENIED' | 'REQUIRES_APPROVAL';
      reason: string;
      policyId?: string;
      approvalId?: string;
    };

    if (data.outcome === 'DENIED') {
      return {
        allowed: false,
        decision: 'BLOCKED',
        policyId: data.policyId,
        approvalId: data.approvalId,
        reason: data.reason,
      };
    }

    if (data.outcome === 'REQUIRES_APPROVAL') {
      return {
        allowed: false,
        decision: 'REQUIRES_APPROVAL',
        policyId: data.policyId,
        approvalId: data.approvalId,
        reason: data.reason,
      };
    }

    return {
      allowed: true,
      decision: 'ALLOWED',
      policyId: data.policyId,
      reason: data.reason,
    };
  } catch (error) {
    console.error('[PolicyCheck] Network error while calling policy-checks:', error);
    return { allowed: true, decision: 'ALLOWED', reason: 'Fallback due to network error' };
  }
}
