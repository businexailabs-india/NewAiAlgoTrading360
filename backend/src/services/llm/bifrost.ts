/**
 * Bifrost LLM gateway helpers.
 * Docs: https://docs.getbifrost.ai/integrations/anthropic-sdk/overview
 */

export function isBifrostEnabled(): boolean {
  // Default ON — Bifrost is the primary LLM gateway unless explicitly disabled.
  const flag = (process.env.BIFROST_ENABLED || 'true').toLowerCase().trim();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  if (flag === 'true' || flag === '1' || flag === 'on') return true;
  return Boolean(process.env.BIFROST_BASE_URL?.trim());
}

export function bifrostBaseUrl(): string {
  return (process.env.BIFROST_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
}

/** Anthropic Messages API via Bifrost drop-in (`/anthropic`). */
export function bifrostAnthropicMessagesUrl(): string {
  if (process.env.BIFROST_ANTHROPIC_URL?.trim()) {
    return process.env.BIFROST_ANTHROPIC_URL.trim().replace(/\/$/, '');
  }
  return `${bifrostBaseUrl()}/anthropic/v1/messages`;
}

/** OpenAI-compatible chat completions via Bifrost. */
export function bifrostOpenAiChatUrl(): string {
  if (process.env.BIFROST_OPENAI_URL?.trim()) {
    return process.env.BIFROST_OPENAI_URL.trim().replace(/\/$/, '');
  }
  return `${bifrostBaseUrl()}/openai/v1/chat/completions`;
}

/**
 * When Bifrost holds provider keys, the client can send a dummy key.
 * If BIFROST_PASS_ANTHROPIC_KEY=true, forward the real ANTHROPIC_API_KEY header.
 */
export function bifrostAnthropicApiKey(): string {
  if ((process.env.BIFROST_PASS_ANTHROPIC_KEY || '').toLowerCase() === 'true') {
    return process.env.ANTHROPIC_API_KEY || 'dummy-key';
  }
  if (isBifrostEnabled()) {
    return process.env.BIFROST_API_KEY || 'dummy-key';
  }
  return process.env.ANTHROPIC_API_KEY || '';
}

export function resolveAnthropicMessagesUrl(): string {
  if (isBifrostEnabled()) return bifrostAnthropicMessagesUrl();
  return (process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages').replace(
    /\/$/,
    ''
  );
}

/**
 * When true, every LLM call is forced to Claude (via Bifrost when enabled).
 * Default is true so Bifrost/Claude is the primary path for all AI queries.
 */
export function forceAnthropicForAllQueries(): boolean {
  const flag = (process.env.LLM_FORCE_ANTHROPIC || process.env.BIFROST_FORCE_ANTHROPIC || 'true')
    .toLowerCase()
    .trim();
  return flag === 'true' || flag === '1' || flag === 'on';
}
