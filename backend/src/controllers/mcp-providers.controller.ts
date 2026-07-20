import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { McpConnectorProxyService } from '../services/mcp-connector-proxy.service';

function uid(req: Request) {
  return req.user!.id;
}

function role(req: Request) {
  return req.user!.role || 'user';
}

export const listProviders = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(uid(req), role(req), '/mcp/providers', {
    query: { country: String(req.query.country || 'IN') }
  });
  res.json({ success: true, data });
});

export const getProvider = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/providers/${encodeURIComponent(req.params.providerId)}`
  );
  res.json({ success: true, data });
});

export const getProviderCapabilities = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/providers/${encodeURIComponent(req.params.providerId)}/capabilities`
  );
  res.json({ success: true, data });
});

export const getProviderRequiredCredentials = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/providers/${encodeURIComponent(req.params.providerId)}/required-credentials`
  );
  res.json({ success: true, data });
});

export const validateProviderConfig = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/providers/${encodeURIComponent(req.params.providerId)}/validate-config`,
    { method: 'POST', body: req.body || {} }
  );
  res.json({ success: true, data });
});

export const reloadProviders = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(uid(req), role(req), '/mcp/providers/reload', {
    method: 'POST',
    body: {},
    asAdmin: true
  });
  res.json({ success: true, data });
});

export const createConnection = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(uid(req), role(req), '/mcp/connections', {
    method: 'POST',
    body: req.body
  });
  res.json({ success: true, data });
});

export const listConnections = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(uid(req), role(req), '/mcp/connections');
  res.json({ success: true, data });
});

export const getConnection = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}`
  );
  res.json({ success: true, data });
});

export const testConnection = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}/test`,
    { method: 'POST', body: {} }
  );
  res.json({ success: true, data });
});

export const refreshConnectionSession = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}/refresh-session`,
    { method: 'POST', body: {} }
  );
  res.json({ success: true, data });
});

export const getConnectionHealth = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}/health`
  );
  res.json({ success: true, data });
});

export const getAccountSnapshot = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}/snapshot`
  );
  res.json({ success: true, data });
});

export const getMargins = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}/margins`
  );
  res.json({ success: true, data });
});

export const getHoldings = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}/holdings`
  );
  res.json({ success: true, data });
});

export const getPositions = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}/positions`
  );
  res.json({ success: true, data });
});

export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}/orders`
  );
  res.json({ success: true, data });
});

export const getTrades = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}/trades`
  );
  res.json({ success: true, data });
});

export const getQuote = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}/quote/${encodeURIComponent(req.params.symbol)}`
  );
  res.json({ success: true, data });
});

export const previewOrder = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}/orders/preview`,
    { method: 'POST', body: req.body }
  );
  res.json({ success: true, data });
});

export const disconnectConnection = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/mcp/connections/${encodeURIComponent(req.params.connectionId)}`,
    { method: 'DELETE' }
  );
  res.json({ success: true, data });
});

export const dhanlaxmiContext = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(uid(req), role(req), '/mcp/dhanlaxmi/context');
  res.json({ success: true, data });
});

export const dhanlaxmiStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(uid(req), role(req), '/mcp/dhanlaxmi/dhan-status');
  res.json({ success: true, data });
});

export const advisoryProviderContext = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(uid(req), role(req), '/mcp/advisory/provider-context');
  res.json({ success: true, data });
});

export const liveTradingHealth = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(uid(req), role(req), '/health');
  res.json({ success: true, data });
});

// ---- Admin ----

export const adminListProviders = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(uid(req), role(req), '/admin/mcp/providers', {
    asAdmin: true
  });
  res.json({ success: true, data });
});

export const enableProvider = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/admin/mcp/providers/${encodeURIComponent(req.params.providerId)}/enable`,
    { method: 'PUT', body: {}, asAdmin: true }
  );
  res.json({ success: true, data });
});

export const disableProvider = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/admin/mcp/providers/${encodeURIComponent(req.params.providerId)}/disable`,
    { method: 'PUT', body: {}, asAdmin: true }
  );
  res.json({ success: true, data });
});

export const updateProviderCapabilities = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/admin/mcp/providers/${encodeURIComponent(req.params.providerId)}/capabilities`,
    { method: 'PUT', body: req.body || {}, asAdmin: true }
  );
  res.json({ success: true, data });
});

export const listProviderHealth = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(uid(req), role(req), '/admin/mcp/provider-health', {
    asAdmin: true
  });
  res.json({ success: true, data });
});

export const adminListConnections = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(uid(req), role(req), '/admin/mcp/connections', {
    asAdmin: true
  });
  res.json({ success: true, data });
});

export const setConnectionLiveTrading = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(
    uid(req),
    role(req),
    `/admin/mcp/connections/${encodeURIComponent(req.params.connectionId)}/live-trading`,
    { method: 'PUT', body: req.body || {}, asAdmin: true }
  );
  res.json({ success: true, data });
});

export const listProviderAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const data = await McpConnectorProxyService.proxy(uid(req), role(req), '/admin/mcp/audit', {
    asAdmin: true
  });
  res.json({ success: true, data });
});
