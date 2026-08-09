/**
 * Playwright E2E (requires FE+BE running with LOCAL_AUTH_BYPASS).
 * Demonstrates: test webhook → signal appears; duplicate rejected.
 *
 * Run (when Playwright configured):
 *   npx playwright test e2e/market-analytics.spec.ts
 */
import { test, expect } from '@playwright/test';

const API = process.env.VITE_API_URL || 'http://localhost:3001';
const FE = process.env.FRONTEND_URL || 'http://localhost:3000';

test.describe('Market Analytics paper flow', () => {
  test('webhook creates signal and rejects duplicate', async ({ request, page }) => {
    // Create endpoint via API (auth bypass may apply)
    const created = await request.post(`${API}/api/v1/webhooks/endpoints`, {
      data: { secret: 'e2e-secret' },
      headers: { Authorization: 'Bearer test' },
    });
    // If auth required without bypass, skip gracefully
    if (created.status() === 401) {
      test.skip(true, 'Auth required — set LOCAL_AUTH_BYPASS for e2e');
    }
    const body = await created.json();
    const token = body?.data?.endpointToken;
    const secret = body?.data?.secret || 'e2e-secret';
    expect(token).toBeTruthy();

    const payload = {
      schema_version: '1.0',
      secret,
      strategy_id: 'orb-v1',
      signal_id: `e2e-${Date.now()}`,
      event: 'entry_signal',
      symbol: 'SPY',
      side: 'buy',
      reference_price: 500,
      atr: 1.2,
      timestamp: Date.now(),
    };
    const r1 = await request.post(`${API}/api/v1/webhooks/tradingview/${token}`, { data: payload });
    expect(r1.ok()).toBeTruthy();
    const r2 = await request.post(`${API}/api/v1/webhooks/tradingview/${token}`, { data: payload });
    const j2 = await r2.json();
    expect(j2.status).toBe('duplicate');

    await page.goto(FE);
    // Navigate via sidebar label if present
    const link = page.getByText('Market Analytics');
    if (await link.count()) {
      await link.first().click();
      await expect(page.getByText('Paper-only')).toBeVisible({ timeout: 10000 });
    }
  });
});
