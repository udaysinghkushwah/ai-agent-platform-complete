/**
 * Pluggable, provider-agnostic email sender. Same reasoning as
 * evaluators/llm-judge.ts: an unconfigured provider should never crash the
 * worker or silently pretend to have sent something — callers get back a
 * clear success/failure so they can record it (AlertEvent.notifyError).
 *
 * Default provider is Resend (simple REST API, no SDK dependency needed).
 * Swap ALERT_EMAIL_PROVIDER + sendViaResend's body shape for another
 * provider without touching callers.
 */

const PROVIDER = process.env.ALERT_EMAIL_PROVIDER ?? 'resend';
const API_KEY = process.env.ALERT_EMAIL_API_KEY;
const FROM_ADDRESS = process.env.ALERT_EMAIL_FROM ?? 'alerts@ai-agent-platform.local';

export interface SendEmailResult {
  sent: boolean;
  error?: string;
}

export async function sendAlertEmail(to: string[], subject: string, body: string): Promise<SendEmailResult> {
  if (to.length === 0) {
    return { sent: false, error: 'No notifyEmails configured on this rule.' };
  }
  if (!API_KEY) {
    return { sent: false, error: 'ALERT_EMAIL_API_KEY is not configured — notification skipped, not failed.' };
  }

  try {
    if (PROVIDER === 'resend') {
      return await sendViaResend(to, subject, body);
    }
    return { sent: false, error: `Unknown ALERT_EMAIL_PROVIDER: ${PROVIDER}` };
  } catch (err) {
    return { sent: false, error: `Email send errored: ${(err as Error).message}` };
  }
}

async function sendViaResend(to: string[], subject: string, body: string): Promise<SendEmailResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, text: body }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    return { sent: false, error: `Resend API returned ${res.status}: ${errBody.slice(0, 300)}` };
  }

  return { sent: true };
}
