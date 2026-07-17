// Helper utility functions

export const calculatePnL = (
  quantity: number,
  averagePrice: number,
  lastPrice: number
): { pnl: number; pnlPercentage: number } => {
  const investedValue = quantity * averagePrice;
  const currentValue = quantity * lastPrice;
  const pnl = currentValue - investedValue;
  const pnlPercentage = (pnl / investedValue) * 100;

  return {
    pnl: Number(pnl.toFixed(2)),
    pnlPercentage: Number(pnlPercentage.toFixed(2))
  };
};

export const calculateTax = (
  buyPrice: number,
  sellPrice: number,
  quantity: number,
  holdingPeriod: number // in days
): { capitalGain: number; tax: number; type: 'STCG' | 'LTCG' } => {
  const capitalGain = (sellPrice - buyPrice) * quantity;
  
  // Long term if held for more than 365 days
  const isLongTerm = holdingPeriod > 365;
  
  let tax = 0;
  if (isLongTerm) {
    // LTCG: 10% above 1 lakh
    const exemptionLimit = 100000;
    const taxableGain = Math.max(0, capitalGain - exemptionLimit);
    tax = taxableGain * 0.10;
  } else {
    // STCG: 15%
    tax = capitalGain * 0.15;
  }

  return {
    capitalGain: Number(capitalGain.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    type: isLongTerm ? 'LTCG' : 'STCG'
  };
};

export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatPercentage = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

export const generateOrderId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `ORD${timestamp}${random}`;
};

export const calculatePortfolioMetrics = (holdings: Array<{
  quantity: number;
  averagePrice: number;
  lastPrice: number;
}>) => {
  let totalInvested = 0;
  let totalCurrent = 0;

  holdings.forEach(holding => {
    totalInvested += holding.quantity * holding.averagePrice;
    totalCurrent += holding.quantity * holding.lastPrice;
  });

  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPercentage = (totalPnL / totalInvested) * 100;

  return {
    totalInvested: Number(totalInvested.toFixed(2)),
    totalCurrent: Number(totalCurrent.toFixed(2)),
    totalPnL: Number(totalPnL.toFixed(2)),
    totalPnLPercentage: Number(totalPnLPercentage.toFixed(2))
  };
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const retry = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await sleep(delay);
    return retry(fn, retries - 1, delay * 2);
  }
};

export const paginate = <T>(
  items: T[],
  page: number = 1,
  limit: number = 10
): { data: T[]; total: number; page: number; totalPages: number } => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const data = items.slice(startIndex, endIndex);

  return {
    data,
    total: items.length,
    page,
    totalPages: Math.ceil(items.length / limit)
  };
};

export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
};

export const calculateSharpeRatio = (
  returns: number[],
  riskFreeRate: number = 0.06
): number => {
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  return (avgReturn - riskFreeRate) / stdDev;
};

export const calculateMaxDrawdown = (values: number[]): number => {
  let maxDrawdown = 0;
  let peak = values[0];

  for (const value of values) {
    if (value > peak) {
      peak = value;
    }
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown * 100; // Return as percentage
};

/** NSE regular session in Asia/Kolkata (IST): Mon–Fri 09:15–15:30 */
export const isMarketOpen = (): boolean => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(new Date());

  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const weekday = get('weekday');
  if (weekday === 'Sat' || weekday === 'Sun') return false;

  const hours = parseInt(get('hour'), 10);
  const minutes = parseInt(get('minute'), 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;

  const time = hours * 60 + minutes;
  const marketOpen = 9 * 60 + 15;
  const marketClose = 15 * 60 + 30;
  return time >= marketOpen && time <= marketClose;
};
