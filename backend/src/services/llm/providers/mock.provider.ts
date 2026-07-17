import { BaseLLMProvider, CompletionPayload } from '../base-llm-provider';
import { ChatMessage, LlmCallOptions, LlmProviderError } from '../types';

/**
 * Deterministic mock provider for unit tests.
 * Never selected as DEFAULT/FALLBACK in production unless explicitly injected
 * or DEFAULT_LLM_PROVIDER=mock with ALLOW_MOCK_LLM=true.
 */
export class MockLLMProvider extends BaseLLMProvider {
  readonly id = 'mock' as const;
  private failNext = false;
  private failCount = 0;

  isAvailable(): boolean {
    return process.env.ALLOW_MOCK_LLM === 'true' || process.env.NODE_ENV === 'test';
  }

  /** Test helper: force next N completions to fail (retryable). */
  setFailNext(n = 1): void {
    this.failNext = true;
    this.failCount = n;
  }

  protected async completeJson(
    _messages: ChatMessage[],
    _options?: LlmCallOptions
  ): Promise<CompletionPayload> {
    if (!this.isAvailable()) {
      throw new LlmProviderError('MockLLMProvider is disabled', this.id, 403, false);
    }

    if (this.failNext && this.failCount > 0) {
      this.failCount -= 1;
      if (this.failCount <= 0) this.failNext = false;
      throw new LlmProviderError('Mock induced failure', this.id, 503, true);
    }

    // Infer schema from system prompt instructions
    const system = _messages.find((m) => m.role === 'system')?.content || '';
    const text = this.payloadFor(system);
    return {
      text,
      model: 'mock-llm',
      usage: { inputTokens: 10, outputTokens: 40, totalTokens: 50, estimatedCostUsd: 0 }
    };
  }

  private payloadFor(system: string): string {
    if (system.includes('Response schema: strategy_rules') || system.includes('entryCriteria')) {
      return JSON.stringify({
        name: 'Mock Momentum',
        description: 'Deterministic mock strategy rules',
        rules: [
          {
            id: 'r1',
            type: 'entry',
            condition: 'rsi < 30',
            action: 'BUY',
            parameters: { lookback: 14 }
          }
        ],
        entryCriteria: ['RSI oversold'],
        exitCriteria: ['RSI overbought'],
        riskControls: ['Max 2% risk per trade']
      });
    }
    if (system.includes('Response schema: risk_explanation') || system.includes('overallRisk')) {
      return JSON.stringify({
        overallRisk: 'MEDIUM',
        score: 55,
        factors: [{ factor: 'Concentration', impact: 'Top holdings overweight', severity: 60 }],
        mitigation: ['Diversify across sectors'],
        narrative: 'Mock risk narrative'
      });
    }
    if (system.includes('Response schema: market_summary') || system.includes('keyDrivers')) {
      return JSON.stringify({
        headline: 'Markets mixed',
        bias: 'NEUTRAL',
        keyDrivers: ['FIIs', 'RBI policy'],
        sectors: [{ name: 'IT', view: 'Cautious' }],
        outlook: 'Range-bound near term'
      });
    }
    if (system.includes('Response schema: strategy_review') || system.includes('APPROVE|REVISE|REJECT')) {
      return JSON.stringify({
        score: 72,
        strengths: ['Clear entry rules'],
        weaknesses: ['Limited risk controls'],
        suggestions: ['Add max drawdown stop'],
        verdict: 'REVISE',
        narrative: 'Mock strategy review'
      });
    }
    return JSON.stringify({
      summary: 'Mock advisory for Indian equities.',
      recommendations: [
        {
          action: 'HOLD',
          symbol: 'NIFTY',
          rationale: 'Deterministic mock recommendation',
          confidence: 60,
          riskNotes: 'Paper trading preferred'
        }
      ],
      risks: ['Market volatility'],
      disclaimer: 'Not financial advice. For testing only.'
    });
  }
}
