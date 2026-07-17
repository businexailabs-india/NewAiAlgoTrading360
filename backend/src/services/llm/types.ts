/** Pluggable LLM provider IDs for AI Advisory Service */
export type LlmProviderId =
  | 'claude'
  | 'openai'
  | 'azure_openai'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'local'
  | 'mock'
  | 'synthesis';

export type LlmOperation =
  | 'generate_advisory'
  | 'generate_strategy_rules'
  | 'explain_risk'
  | 'summarize_market'
  | 'review_strategy';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number | null;
}

export interface LlmProviderResult<T = unknown> {
  data: T;
  provider: LlmProviderId;
  model: string;
  operation: LlmOperation;
  usage: TokenUsage;
  latencyMs: number;
  usedFallback: boolean;
  rawText?: string;
}

export interface AdvisoryResponse {
  summary: string;
  recommendations: Array<{
    action: 'BUY' | 'SELL' | 'HOLD' | 'WATCH' | 'REBALANCE';
    symbol?: string;
    rationale: string;
    confidence: number;
    riskNotes?: string;
  }>;
  risks: string[];
  disclaimer: string;
}

export interface StrategyRulesResponse {
  name: string;
  description: string;
  rules: Array<{
    id: string;
    type: string;
    condition: string;
    action: string;
    parameters?: Record<string, unknown>;
  }>;
  entryCriteria: string[];
  exitCriteria: string[];
  riskControls: string[];
}

export interface RiskExplanationResponse {
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  factors: Array<{ factor: string; impact: string; severity: number }>;
  mitigation: string[];
  narrative: string;
}

export interface MarketSummaryResponse {
  headline: string;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  keyDrivers: string[];
  sectors: Array<{ name: string; view: string }>;
  outlook: string;
}

export interface StrategyReviewResponse {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  verdict: 'APPROVE' | 'REVISE' | 'REJECT';
  narrative: string;
}

export type SchemaName =
  | 'advisory'
  | 'strategy_rules'
  | 'risk_explanation'
  | 'market_summary'
  | 'strategy_review';

export interface LlmCallOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  adapterJobId?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LlmProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: LlmProviderId,
    public readonly statusCode?: number,
    public readonly retryable = false,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}
