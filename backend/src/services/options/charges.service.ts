/** Configurable NSE F&O charges estimator (paper / preview). */

export type ChargesInput = {
  premium: number;
  quantity: number; // total units (lots * lotSize)
  side: 'BUY' | 'SELL';
  optionType: 'CE' | 'PE' | 'FUT';
};

export type ChargesBreakdown = {
  brokerage: number;
  stt: number;
  exchangeTxn: number;
  gst: number;
  stamp: number;
  sebi: number;
  total: number;
};

const cfg = {
  brokeragePerOrder: Number(process.env.PAPER_BROKERAGE_PER_ORDER || 20),
  sttSellOptPct: Number(process.env.PAPER_STT_SELL_OPT || 0.0625) / 100, // on premium
  exchangePct: Number(process.env.PAPER_EXCHANGE_TXN || 0.03503) / 100,
  gstPct: 0.18,
  stampBuyPct: Number(process.env.PAPER_STAMP || 0.003) / 100,
  sebiPerCr: 10
};

export function estimateCharges(input: ChargesInput): ChargesBreakdown {
  const turnover = Math.abs(input.premium * input.quantity);
  const brokerage = Math.min(cfg.brokeragePerOrder, turnover * 0.0003 || cfg.brokeragePerOrder);
  const stt =
    input.side === 'SELL' && input.optionType !== 'FUT' ? turnover * cfg.sttSellOptPct : 0;
  const exchangeTxn = turnover * cfg.exchangePct;
  const sebi = (turnover / 1e7) * cfg.sebiPerCr;
  const gst = (brokerage + exchangeTxn + sebi) * cfg.gstPct;
  const stamp = input.side === 'BUY' ? turnover * cfg.stampBuyPct : 0;
  const total = Number((brokerage + stt + exchangeTxn + gst + stamp + sebi).toFixed(2));
  return {
    brokerage: Number(brokerage.toFixed(2)),
    stt: Number(stt.toFixed(2)),
    exchangeTxn: Number(exchangeTxn.toFixed(2)),
    gst: Number(gst.toFixed(2)),
    stamp: Number(stamp.toFixed(2)),
    sebi: Number(sebi.toFixed(2)),
    total
  };
}

/** Bid/ask slippage model for paper fills */
export function applySlippage(
  mid: number,
  side: 'BUY' | 'SELL',
  slippageBps = Number(process.env.PAPER_SLIPPAGE_BPS || 5)
): number {
  if (!(mid > 0)) return mid;
  const slip = mid * (slippageBps / 10000);
  return Number((side === 'BUY' ? mid + slip : Math.max(0.05, mid - slip)).toFixed(2));
}
