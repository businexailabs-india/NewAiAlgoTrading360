/**
 * Phase 2 frontend API contracts — Advisory-to-Algo + DhanLaxmi Prompt-to-Algo.
 * Paths are relative to the BFF (`API_BASE_URL`).
 */

export const PHASE2_API = {
  advisory: {
    generate: 'POST /advisory/generate',
    latest: 'GET /advisory/latest',
    convertToAlgo: 'POST /advisory/{id}/recommendations/{recommendation_id}/convert-to-algo',
    paperTest: 'POST /strategy-options/{id}/paper-test',
    save: 'POST /strategy-options/{id}/save',
    deployPaper: 'POST /strategy-options/{id}/deploy-paper',
  },
  dhanlaxmi: {
    chat: 'POST /dhanlaxmi/chat',
    strategyDraft: 'POST /dhanlaxmi/strategy-draft',
    paperTest: 'POST /dhanlaxmi/paper-test',
    intent: 'POST /dhanlaxmi/intent',
  },
} as const;

export type Phase2AdvisoryStatus = 'preparing' | 'ready' | 'failed' | 'expired' | 'dismissed';

export interface Phase2AdvisoryRecommendation {
  id: string;
  title: string;
  type: string;
  symbols: string[];
  confidence_score: number;
  risk_score: number;
  required_capital: number;
  timeframe: string;
  rationale: string;
  warnings: string[];
  actions: string[];
  direction?: string;
  paper_only?: boolean;
  rank?: number;
  stop_loss_required?: boolean;
  explanation?: string;
}

export interface Phase2LoginAdvisory {
  advisory_id: string | null;
  status: Phase2AdvisoryStatus;
  generated_at?: string;
  market_status?: string;
  broker_status?: string;
  risk_profile?: string;
  summary: string;
  recommendations: Phase2AdvisoryRecommendation[];
  warnings?: string[];
  disclaimer?: string;
}

export interface Phase2StrategyConfig {
  strategy_id: string;
  strategy_name: string;
  strategy_type: string;
  symbols: string[];
  timeframe: string;
  paper_trading_required: boolean;
  live_trading_enabled: boolean;
  risk_warning: string;
  entry_rules: Record<string, unknown>;
  exit_rules: Record<string, unknown>;
  risk_rules: Record<string, unknown>;
  position_sizing: Record<string, unknown>;
}

export interface Phase2StrategyOption {
  id: string;
  strategy_name: string;
  strategy_type: string;
  paper_test_required: boolean;
  live_enabled: boolean;
  strategy_config?: Phase2StrategyConfig;
  config?: Record<string, unknown>;
}

export interface Phase2PaperTestResult {
  strategy_draft_id?: string;
  strategy_id?: string;
  status: string;
  paper_only: boolean;
  live_trading_enabled?: boolean;
  metrics: {
    pnl: number;
    max_drawdown: number;
    trade_count: number;
    qualified_for_live: boolean;
    win_rate?: number;
    orders_placed?: number;
  };
  explanation?: string;
  disclaimer?: string;
  risk_warning?: string;
}

export interface Phase2OrderPreview {
  symbol?: string;
  side?: string;
  quantity?: number;
  executed: boolean;
  live_trading_enabled: boolean;
  requires_approval: boolean;
  risk_warning: string;
}

export interface Phase2DhanLaxmiChatResponse {
  conversation_id: string;
  language: string;
  intent: string;
  confidence?: number;
  response_text: string;
  disclaimer?: string;
  cards: Array<{ type: string; data: Record<string, unknown> }>;
  approval_id?: string | null;
  strategy_draft_id?: string | null;
  never_auto_executes?: boolean;
  paper_first?: boolean;
}

/** Sample prompts accepted by DhanLaxmi (Hinglish / Hindi / English / Odia). */
export const DHANLAXMI_SAMPLE_PROMPTS = [
  'Reliance ke liye intraday algo banao',
  'TCS ko paper test karo',
  'ମୋ portfolio risk କହ',
  'Aaj safe algo suggest karo',
  'Buy 10 Reliance now',
] as const;
