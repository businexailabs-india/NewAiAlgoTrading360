import {
  AdvisoryResponse,
  MarketSummaryResponse,
  RiskExplanationResponse,
  SchemaName,
  StrategyReviewResponse,
  StrategyRulesResponse
} from './types';

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Missing or invalid string field: ${key}`);
  return v;
}

function requireNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || Number.isNaN(v)) throw new Error(`Missing or invalid number field: ${key}`);
  return v;
}

function requireArray(obj: Record<string, unknown>, key: string): unknown[] {
  const v = obj[key];
  if (!Array.isArray(v)) throw new Error(`Missing or invalid array field: ${key}`);
  return v;
}

export function parseJsonFromLlmText(text: string): unknown {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('Empty LLM response');

  // Prefer fenced JSON block
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Try first {...} slice
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error('LLM response is not valid JSON');
  }
}

export function validateAdvisory(data: unknown): AdvisoryResponse {
  if (!isObject(data)) throw new Error('Advisory must be an object');
  const summary = requireString(data, 'summary');
  const disclaimer = requireString(data, 'disclaimer');
  const risks = requireArray(data, 'risks').map((r, i) => {
    if (typeof r !== 'string') throw new Error(`risks[${i}] must be string`);
    return r;
  });
  const recommendations = requireArray(data, 'recommendations').map((item, i) => {
    if (!isObject(item)) throw new Error(`recommendations[${i}] must be object`);
    const action = requireString(item, 'action').toUpperCase();
    const allowed = ['BUY', 'SELL', 'HOLD', 'WATCH', 'REBALANCE'];
    if (!allowed.includes(action)) throw new Error(`recommendations[${i}].action invalid`);
    const confidence = requireNumber(item, 'confidence');
    return {
      action: action as AdvisoryResponse['recommendations'][0]['action'],
      symbol: typeof item.symbol === 'string' ? item.symbol : undefined,
      rationale: requireString(item, 'rationale'),
      confidence,
      riskNotes: typeof item.riskNotes === 'string' ? item.riskNotes : undefined
    };
  });
  return { summary, recommendations, risks, disclaimer };
}

export function validateStrategyRules(data: unknown): StrategyRulesResponse {
  if (!isObject(data)) throw new Error('Strategy rules must be an object');
  const rules = requireArray(data, 'rules').map((item, i) => {
    if (!isObject(item)) throw new Error(`rules[${i}] must be object`);
    return {
      id: requireString(item, 'id'),
      type: requireString(item, 'type'),
      condition: requireString(item, 'condition'),
      action: requireString(item, 'action'),
      parameters: isObject(item.parameters) ? item.parameters : undefined
    };
  });
  return {
    name: requireString(data, 'name'),
    description: requireString(data, 'description'),
    rules,
    entryCriteria: requireArray(data, 'entryCriteria').map(String),
    exitCriteria: requireArray(data, 'exitCriteria').map(String),
    riskControls: requireArray(data, 'riskControls').map(String)
  };
}

export function validateRiskExplanation(data: unknown): RiskExplanationResponse {
  if (!isObject(data)) throw new Error('Risk explanation must be an object');
  const overallRisk = requireString(data, 'overallRisk').toUpperCase();
  const allowed = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!allowed.includes(overallRisk)) throw new Error('overallRisk invalid');
  const factors = requireArray(data, 'factors').map((item, i) => {
    if (!isObject(item)) throw new Error(`factors[${i}] must be object`);
    return {
      factor: requireString(item, 'factor'),
      impact: requireString(item, 'impact'),
      severity: requireNumber(item, 'severity')
    };
  });
  return {
    overallRisk: overallRisk as RiskExplanationResponse['overallRisk'],
    score: requireNumber(data, 'score'),
    factors,
    mitigation: requireArray(data, 'mitigation').map(String),
    narrative: requireString(data, 'narrative')
  };
}

export function validateMarketSummary(data: unknown): MarketSummaryResponse {
  if (!isObject(data)) throw new Error('Market summary must be an object');
  const bias = requireString(data, 'bias').toUpperCase();
  const allowed = ['BULLISH', 'BEARISH', 'NEUTRAL', 'MIXED'];
  if (!allowed.includes(bias)) throw new Error('bias invalid');
  const sectors = requireArray(data, 'sectors').map((item, i) => {
    if (!isObject(item)) throw new Error(`sectors[${i}] must be object`);
    return { name: requireString(item, 'name'), view: requireString(item, 'view') };
  });
  return {
    headline: requireString(data, 'headline'),
    bias: bias as MarketSummaryResponse['bias'],
    keyDrivers: requireArray(data, 'keyDrivers').map(String),
    sectors,
    outlook: requireString(data, 'outlook')
  };
}

export function validateStrategyReview(data: unknown): StrategyReviewResponse {
  if (!isObject(data)) throw new Error('Strategy review must be an object');
  const verdict = requireString(data, 'verdict').toUpperCase();
  const allowed = ['APPROVE', 'REVISE', 'REJECT'];
  if (!allowed.includes(verdict)) throw new Error('verdict invalid');
  return {
    score: requireNumber(data, 'score'),
    strengths: requireArray(data, 'strengths').map(String),
    weaknesses: requireArray(data, 'weaknesses').map(String),
    suggestions: requireArray(data, 'suggestions').map(String),
    verdict: verdict as StrategyReviewResponse['verdict'],
    narrative: requireString(data, 'narrative')
  };
}

export function validateBySchema(schema: SchemaName, data: unknown): unknown {
  switch (schema) {
    case 'advisory':
      return validateAdvisory(data);
    case 'strategy_rules':
      return validateStrategyRules(data);
    case 'risk_explanation':
      return validateRiskExplanation(data);
    case 'market_summary':
      return validateMarketSummary(data);
    case 'strategy_review':
      return validateStrategyReview(data);
    default:
      throw new Error(`Unknown schema: ${schema}`);
  }
}

export const SCHEMA_INSTRUCTIONS: Record<SchemaName, string> = {
  advisory: `Return ONLY valid JSON with keys: summary (string), recommendations (array of {action: BUY|SELL|HOLD|WATCH|REBALANCE, symbol?, rationale, confidence:0-100, riskNotes?}), risks (string[]), disclaimer (string).`,
  strategy_rules: `Return ONLY valid JSON with keys: name, description, rules (array of {id, type, condition, action, parameters?}), entryCriteria (string[]), exitCriteria (string[]), riskControls (string[]).`,
  risk_explanation: `Return ONLY valid JSON with keys: overallRisk (LOW|MEDIUM|HIGH|CRITICAL), score (0-100), factors (array of {factor, impact, severity}), mitigation (string[]), narrative (string).`,
  market_summary: `Return ONLY valid JSON with keys: headline, bias (BULLISH|BEARISH|NEUTRAL|MIXED), keyDrivers (string[]), sectors (array of {name, view}), outlook (string).`,
  strategy_review: `Return ONLY valid JSON with keys: score (0-100), strengths (string[]), weaknesses (string[]), suggestions (string[]), verdict (APPROVE|REVISE|REJECT), narrative (string).`
};
