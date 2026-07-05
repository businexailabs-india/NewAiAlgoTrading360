const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export interface AdvisorChatResponse {
  reply: string;
  provider: string;
  sources: Array<{ title: string; score: number; symbol?: string; method?: string }>;
  context: Record<string, unknown>;
}

export const advisorService = {
  async chat(message: string, symbol?: string, adapterJobId?: string): Promise<AdvisorChatResponse> {
    const res = await fetch(`${API_BASE_URL}/advisor/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message, symbol, adapterJobId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Advisor request failed');
    return data.data;
  }
};

export const knowledgeService = {
  async listDocuments(symbol?: string) {
    const q = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
    const res = await fetch(`${API_BASE_URL}/knowledge/documents${q}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async createDocument(payload: {
    title: string;
    content: string;
    docType?: string;
    symbol?: string;
    tags?: string[];
  }) {
    const res = await fetch(`${API_BASE_URL}/knowledge/documents`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async query(query: string, symbol?: string) {
    const res = await fetch(`${API_BASE_URL}/knowledge/query`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query, symbol })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  }
};

export const llmService = {
  async getStatus() {
    const res = await fetch(`${API_BASE_URL}/llm/status`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async startTraining(payload: {
    name: string;
    baseModel?: string;
    trainType?: 'lora' | 'qlora';
    config?: Record<string, unknown>;
  }) {
    const res = await fetch(`${API_BASE_URL}/llm/train`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async listAdapters() {
    const res = await fetch(`${API_BASE_URL}/llm/adapters`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  }
};
