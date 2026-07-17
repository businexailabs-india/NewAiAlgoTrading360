import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface McpClientOptions {
  endpoint: string;
  transport?: 'HTTP' | 'SSE';
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * Minimal MCP HTTP/SSE JSON-RPC client for tool discovery and invocation.
 * Compatible with streamable HTTP MCP servers that accept JSON-RPC POSTs.
 */
export class McpHttpClient {
  private http: AxiosInstance;
  private endpoint: string;
  private requestId = 1;

  constructor(opts: McpClientOptions) {
    this.endpoint = opts.endpoint.replace(/\/$/, '');
    this.http = axios.create({
      baseURL: this.endpoint,
      timeout: opts.timeoutMs || 20000,
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    });
  }

  private nextId() {
    return this.requestId++;
  }

  private async rpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    const body = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method,
      params: params || {}
    };

    const started = Date.now();
    try {
      const res = await this.http.post('', body);
      const data = res.data;
      if (data?.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
      }
      logger.debug?.(`MCP ${method} ok in ${Date.now() - started}ms`);
      return (data?.result ?? data) as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`MCP RPC ${method} failed: ${message}`);
      throw err;
    }
  }

  async initialize(): Promise<{ protocolVersion?: string; serverInfo?: { name?: string } }> {
    try {
      return await this.rpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'smarttrade-backend', version: '1.0.0' }
      });
    } catch {
      // Some gateways skip initialize; treat as soft success
      return { serverInfo: { name: 'unknown' } };
    }
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    try {
      const result = await this.rpc<{ tools?: McpToolDescriptor[] }>('tools/list');
      return result?.tools || [];
    } catch {
      // Fallback for servers that expose REST /tools
      try {
        const res = await this.http.get('/tools');
        const tools = res.data?.tools || res.data || [];
        return Array.isArray(tools) ? tools : [];
      } catch {
        return [];
      }
    }
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    try {
      const result = await this.rpc<{ content?: Array<{ type: string; text?: string }>; structuredContent?: unknown }>(
        'tools/call',
        { name, arguments: args }
      );
      if (result?.structuredContent) return result.structuredContent;
      const text = result?.content?.find(c => c.type === 'text')?.text;
      if (text) {
        try { return JSON.parse(text); } catch { return text; }
      }
      return result;
    } catch (err) {
      // REST fallback: POST /tools/:name
      const res = await this.http.post(`/tools/${encodeURIComponent(name)}`, args);
      return res.data;
    }
  }

  async health(): Promise<{ ok: boolean; latencyMs: number; tools: string[]; error?: string }> {
    const started = Date.now();
    try {
      await this.initialize();
      const tools = await this.listTools();
      return {
        ok: true,
        latencyMs: Date.now() - started,
        tools: tools.map(t => t.name)
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        tools: [],
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
}
