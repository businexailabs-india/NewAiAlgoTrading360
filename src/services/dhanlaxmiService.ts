import { API_BASE_URL } from '../lib/api';

function headers(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.detail || `Request failed (${res.status})`);
  return body.data as T;
}

export type DhanLaxmiCard = {
  type: string;
  data: Record<string, unknown>;
};

export type DhanLaxmiChatResponse = {
  conversation_id: string;
  language: string;
  intent: string;
  confidence?: number;
  response_text: string;
  disclaimer?: string;
  parsed_command?: Record<string, unknown>;
  guardrails?: Record<string, unknown>;
  cards: DhanLaxmiCard[];
  approval_id?: string | null;
  strategy_draft_id?: string | null;
  never_auto_executes?: boolean;
  paper_first?: boolean;
};

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'hinglish', label: 'Hinglish' },
  { code: 'or', label: 'ଓଡ଼ିଆ' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'mr', label: 'मराठी' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'as', label: 'অসমীয়া' },
  { code: 'ur', label: 'اردو' }
];

export type DhanLaxmiPaperTestResult = {
  strategy_draft_id: string;
  strategy_id?: string;
  status: string;
  paper_only: boolean;
  live_trading_enabled?: boolean;
  metrics: {
    pnl: number;
    max_drawdown: number;
    trade_count: number;
    qualified_for_live: boolean;
  };
  explanation?: string;
  disclaimer?: string;
  risk_warning?: string;
};

export type DhanLaxmiOrderPreview = {
  symbol?: string;
  side?: string;
  quantity?: number;
  executed?: boolean;
  live_trading_enabled?: boolean;
  requires_approval?: boolean;
  risk_warning?: string;
};

export const dhanlaxmiService = {
  async chat(message: string, opts?: {
    conversation_id?: string;
    language_hint?: string;
    mode?: string;
    context?: Record<string, unknown>;
  }): Promise<DhanLaxmiChatResponse> {
    const res = await fetch(`${API_BASE_URL}/dhanlaxmi/chat`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        message,
        conversation_id: opts?.conversation_id,
        language_hint: opts?.language_hint,
        mode: opts?.mode || 'web',
        context: opts?.context
      })
    });
    return json(res);
  },

  async strategyDraft(message: string, opts?: {
    conversation_id?: string;
    language_hint?: string;
    context?: Record<string, unknown>;
  }): Promise<DhanLaxmiChatResponse> {
    const res = await fetch(`${API_BASE_URL}/dhanlaxmi/strategy-draft`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        message,
        conversation_id: opts?.conversation_id,
        language_hint: opts?.language_hint,
        context: opts?.context
      })
    });
    return json(res);
  },

  async paperTest(strategy_draft_id: string, conversation_id?: string): Promise<DhanLaxmiPaperTestResult> {
    const res = await fetch(`${API_BASE_URL}/dhanlaxmi/paper-test`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ strategy_draft_id, conversation_id })
    });
    return json(res);
  },

  async intent(message: string) {
    const res = await fetch(`${API_BASE_URL}/dhanlaxmi/intent`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ message })
    });
    return json(res);
  },

  async getApproval(id: string) {
    const res = await fetch(`${API_BASE_URL}/approvals/${id}`, { headers: headers() });
    return json(res);
  },

  async approve(id: string, body: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/approvals/${id}/approve`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });
    return json(res);
  },

  async reject(id: string) {
    const res = await fetch(`${API_BASE_URL}/approvals/${id}/reject`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({})
    });
    return json(res);
  },

  async voiceCommand(text: string, opts?: { conversation_id?: string; language_hint?: string }) {
    const res = await fetch(`${API_BASE_URL}/voice/command`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        text,
        conversation_id: opts?.conversation_id,
        language_hint: opts?.language_hint
      })
    });
    return json(res);
  }
};
