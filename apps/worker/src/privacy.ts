/**
 * Enterprise Privacy & Security Engine — Automatically sanitizes sensitive PII
 * (Emails, Credit Cards, SSN, API Keys) and applies project-specific privacy rules
 * on all telemetry payloads before DB persistence.
 */

const REDACTED = '[REDACTED]';
const WITHHELD = '[withheld: raw payload storage disabled for this project]';
const LARGE_VALUE_THRESHOLD = 200; // chars

export interface ProjectPrivacySettings {
  disableRawPayloadStorage: boolean;
  sensitiveFieldMasks: string[];
}

export function redactPiiText(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARD_REDACTED]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]')
    .replace(/(?:sk-[a-zA-Z0-9]{20,}|Bearer\s+[a-zA-Z0-9._-]{20,}|api_key=[a-zA-Z0-9._-]{16,})/gi, '[KEY_REDACTED]');
}

function redactPiiValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactPiiText(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactPiiValue);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = redactPiiValue(val);
    }
    return result;
  }
  return value;
}

function maskObject(value: unknown, maskKeys: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => maskObject(v, maskKeys));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = maskKeys.has(key.toLowerCase()) ? REDACTED : maskObject(val, maskKeys);
    }
    return result;
  }
  return value;
}

function withholdLargeText(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > LARGE_VALUE_THRESHOLD ? WITHHELD : value;
  }
  if (Array.isArray(value)) {
    return value.map(withholdLargeText);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = withholdLargeText(val);
    }
    return result;
  }
  return value;
}

export function applyPrivacySettings(
  metadata: unknown,
  payloadReference: string | undefined,
  settings: ProjectPrivacySettings,
): { metadata: unknown; payloadReference: string | undefined } {
  // 1. Always sanitize PII (Emails, Credit Cards, SSNs, API Keys)
  let processedMetadata = redactPiiValue(metadata);

  // 2. Mask sensitive field names configured for this project
  if (settings.sensitiveFieldMasks.length > 0 && processedMetadata) {
    const maskKeys = new Set(settings.sensitiveFieldMasks.map((f) => f.toLowerCase()));
    processedMetadata = maskObject(processedMetadata, maskKeys);
  }

  // 3. Withhold large payloads if raw payload storage is disabled
  if (settings.disableRawPayloadStorage) {
    processedMetadata = processedMetadata ? withholdLargeText(processedMetadata) : processedMetadata;
    return { metadata: processedMetadata, payloadReference: undefined };
  }

  return { metadata: processedMetadata, payloadReference };
}
