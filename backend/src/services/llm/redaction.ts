const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g;
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const API_KEYISH_RE =
  /\b(?:sk-|sk-ant-|sk-or-|AIza|ghp_|xox[baprs]-)[A-Za-z0-9_-]{8,}\b/g;

const SECRET_KEY_RE =
  /^(.*)?(access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password|authorization|client[_-]?id|dhan[_-]?client|broker[_-]?token|credentials?)(.*)?$/i;

function redactString(input: string): string {
  return input
    .replace(JWT_RE, '[REDACTED_JWT]')
    .replace(BEARER_RE, 'Bearer [REDACTED]')
    .replace(API_KEYISH_RE, '[REDACTED_KEY]')
    .replace(EMAIL_RE, '[REDACTED_EMAIL]')
    .replace(PAN_RE, '[REDACTED_PAN]')
    .replace(AADHAAR_RE, '[REDACTED_AADHAAR]')
    .replace(PHONE_RE, '[REDACTED_PHONE]');
}

/**
 * Redact PII and broker/API secrets from prompts and context before remote LLM calls.
 * Never log the unredacted payload.
 */
export function redactForLlm(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[REDACTED_DEPTH]';
  if (value == null) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v) => redactForLlm(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactForLlm(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export function redactPrompt(prompt: string): string {
  return redactString(prompt);
}

export function safeContextJson(context: unknown): string {
  return JSON.stringify(redactForLlm(context) ?? {}, null, 2);
}
