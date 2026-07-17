/**
 * Unit tests for pluggable LLM provider layer (no live API calls).
 * Run via: npm run test:unit
 */
import assert from 'assert';
import { redactForLlm, redactPrompt } from '../src/services/llm/redaction';
import { parseJsonFromLlmText, validateAdvisory, validateBySchema } from '../src/services/llm/schemas';
import { estimateCostUsd, normalizeUsage } from '../src/services/llm/usage';
import { withRetry, isRetryableError } from '../src/services/llm/retry';
import { MockLLMProvider } from '../src/services/llm/providers/mock.provider';
import { ClaudeProvider } from '../src/services/llm/providers/claude.provider';
import { LlmProviderRegistry, resetLlmRegistry } from '../src/services/llm/registry';
import { LlmProviderError } from '../src/services/llm/types';
import { BaseLLMProvider } from '../src/services/llm/base-llm-provider';

process.env.NODE_ENV = 'test';
process.env.ALLOW_MOCK_LLM = 'true';
process.env.LLM_MAX_RETRIES = '2';
process.env.LLM_TIMEOUT_SECONDS = '5';
process.env.LLM_FORCE_ANTHROPIC = 'false';
delete process.env.BIFROST_ENABLED;
delete process.env.BIFROST_BASE_URL;

function assertTrue(cond: unknown, msg: string) {
  assert.ok(cond, msg);
}

async function run() {
  // --- Redaction ---
  const redacted = redactPrompt(
    'Contact me@example.com token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb Bearer sk-ant-secret123 ABCPD1234E'
  ) as string;
  assertTrue(!redacted.includes('me@example.com'), 'email redacted');
  assertTrue(redacted.includes('[REDACTED_JWT]'), 'jwt redacted');
  assertTrue(redacted.includes('[REDACTED_KEY]') || redacted.includes('[REDACTED]'), 'api key redacted');
  assertTrue(redacted.includes('[REDACTED_PAN]'), 'PAN redacted');

  const ctx = redactForLlm({
    accessToken: 'super-secret',
    clientId: '1112656215',
    note: 'ok',
    nested: { api_key: 'x', email: 'a@b.com' }
  }) as Record<string, unknown>;
  assertTrue(ctx.accessToken === '[REDACTED]', 'accessToken redacted');
  assertTrue(ctx.clientId === '[REDACTED]', 'clientId redacted');
  assertTrue((ctx.nested as Record<string, unknown>).api_key === '[REDACTED]', 'nested key redacted');

  // --- Schema validation ---
  const good = validateAdvisory({
    summary: 's',
    recommendations: [{ action: 'HOLD', rationale: 'r', confidence: 50 }],
    risks: ['r1'],
    disclaimer: 'd'
  });
  assertTrue(good.summary === 's', 'advisory ok');

  let threw = false;
  try {
    validateBySchema('advisory', { summary: 'only' });
  } catch {
    threw = true;
  }
  assertTrue(threw, 'malformed advisory rejected');

  const parsed = parseJsonFromLlmText('Here:\n```json\n{"summary":"x","recommendations":[],"risks":[],"disclaimer":"d"}\n```');
  assertTrue((parsed as { summary: string }).summary === 'x', 'fenced json parse');

  // --- Usage / cost ---
  const usage = normalizeUsage('gpt-4o-mini', { promptTokens: 1000, completionTokens: 500 });
  assertTrue(usage.totalTokens === 1500, 'token sum');
  assertTrue(typeof usage.estimatedCostUsd === 'number', 'cost estimated');
  assertTrue(estimateCostUsd('local-ollama', 100, 100) === null, 'unknown model cost null');

  // --- Retry ---
  let attempts = 0;
  const val = await withRetry(
    'mock',
    async () => {
      attempts += 1;
      if (attempts < 3) throw new LlmProviderError('temp', 'mock', 503, true);
      return 'ok';
    },
    { maxRetries: 2, baseDelayMs: 1 }
  );
  assertTrue(val === 'ok' && attempts === 3, 'retry then succeed');
  assertTrue(isRetryableError(new LlmProviderError('x', 'claude', 429, true)), '429 retryable');

  // --- Mock provider operations ---
  const mock = new MockLLMProvider();
  assertTrue(mock.isAvailable(), 'mock available in test');

  const advisory = await mock.generate_advisory('Should I buy?', { symbol: 'RELIANCE' });
  assertTrue(advisory.data.summary.length > 0, 'advisory summary');
  assertTrue(advisory.provider === 'mock', 'provider id mock');
  assertTrue(advisory.usage.totalTokens > 0, 'usage logged');

  const rules = await mock.generate_strategy_rules('Build RSI strategy', {});
  assertTrue(rules.data.rules.length >= 1, 'strategy rules');

  const risk = await mock.explain_risk({ name: 's' }, { holdings: [] }, { nifty: 'flat' });
  assertTrue(risk.data.overallRisk === 'MEDIUM', 'risk explanation');

  const market = await mock.summarize_market({ nifty: 24000 });
  assertTrue(market.data.bias === 'NEUTRAL', 'market summary');

  const review = await mock.review_strategy({ name: 'test', rules: [] });
  assertTrue(review.data.verdict === 'REVISE', 'strategy review');

  // Schema validation via interface
  const validated = mock.validate_response_schema(advisory.data, 'advisory');
  assertTrue((validated as { disclaimer: string }).disclaimer.length > 0, 'validate_response_schema');

  // --- Claude unavailable without key ---
  const prevKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const claude = new ClaudeProvider();
  assertTrue(!claude.isAvailable(), 'claude unavailable without key');
  if (prevKey) process.env.ANTHROPIC_API_KEY = prevKey;

  // --- Registry fallback ---
  class FailingPrimary extends BaseLLMProvider {
    readonly id = 'claude' as const;
    isAvailable() {
      return true;
    }
    protected async completeJson() {
      throw new LlmProviderError('Claude down', 'claude', 500, true);
    }
  }

  process.env.DEFAULT_LLM_PROVIDER = 'claude';
  process.env.FALLBACK_LLM_PROVIDER = 'mock';
  const registry = new LlmProviderRegistry([new FailingPrimary(), new MockLLMProvider()]);
  const fb = await registry.generate_advisory('test', { a: 1 });
  assertTrue(fb.usedFallback === true, 'used fallback');
  assertTrue(fb.provider === 'mock', 'fallback provider mock');

  // Circular / same fallback rejected
  process.env.FALLBACK_LLM_PROVIDER = 'claude';
  let circular = false;
  try {
    registry.resolveFallback('claude');
  } catch {
    circular = true;
  }
  assertTrue(circular, 'circular fallback rejected');

  // Mock blocked as default without ALLOW_MOCK_LLM in non-test — simulate by clearing flags
  process.env.DEFAULT_LLM_PROVIDER = 'mock';
  process.env.ALLOW_MOCK_LLM = 'false';
  process.env.NODE_ENV = 'production';
  let mockBlocked = false;
  try {
    new LlmProviderRegistry().resolveDefault();
  } catch {
    mockBlocked = true;
  }
  assertTrue(mockBlocked, 'mock default blocked in production');
  process.env.NODE_ENV = 'test';
  process.env.ALLOW_MOCK_LLM = 'true';
  process.env.DEFAULT_LLM_PROVIDER = 'mock';
  process.env.FALLBACK_LLM_PROVIDER = 'local';

  // Missing API key path for Claude via registry without fallback available
  process.env.DEFAULT_LLM_PROVIDER = 'claude';
  process.env.FALLBACK_LLM_PROVIDER = 'openai';
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const emptyReg = new LlmProviderRegistry();
  let failed = false;
  try {
    await emptyReg.generate_advisory('x', {});
  } catch {
    failed = true;
  }
  assertTrue(failed, 'missing keys fail');

  resetLlmRegistry();
  console.log('unit-llm-providers: PASS');
}

run().catch((err) => {
  console.error('unit-llm-providers: FAIL', err);
  process.exit(1);
});
