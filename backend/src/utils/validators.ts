// Input validation utilities

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^[6-9]\d{9}$/; // Indian phone number
  return phoneRegex.test(phone);
};

export const validateSymbol = (symbol: string): boolean => {
  // Equity / index / F&O compact symbols (e.g. NIFTY24000CE)
  const symbolRegex = /^[A-Z0-9]{1,32}$/;
  return symbolRegex.test(symbol.toUpperCase());
};

export const validateExchange = (exchange: string): boolean => {
  const validExchanges = ['NSE', 'BSE', 'NFO', 'BFO', 'MCX', 'INDEX'];
  return validExchanges.includes(exchange.toUpperCase());
};

export const validateOrderType = (orderType: string): boolean => {
  const validOrderTypes = ['MARKET', 'LIMIT', 'SL', 'SL-M'];
  return validOrderTypes.includes(orderType.toUpperCase());
};

export const validateTradeType = (tradeType: string): boolean => {
  const validTradeTypes = ['BUY', 'SELL'];
  return validTradeTypes.includes(tradeType.toUpperCase());
};

export const validateProduct = (product: string): boolean => {
  const validProducts = ['CNC', 'MIS', 'NRML'];
  return validProducts.includes(product.toUpperCase());
};

export const validateQuantity = (quantity: number): boolean => {
  return Number.isInteger(quantity) && quantity > 0;
};

export const validatePrice = (price: number): boolean => {
  return typeof price === 'number' && price > 0 && isFinite(price);
};

export const sanitizeString = (input: string): string => {
  // Remove potentially dangerous characters
  return input.replace(/[<>\"']/g, '');
};

export const validateBroker = (broker: string): boolean => {
  const validBrokers = ['zerodha', 'upstox', 'angelone'];
  return validBrokers.includes(broker.toLowerCase());
};

export const validateDateRange = (startDate: string, endDate: string): boolean => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start <= end && !isNaN(start.getTime()) && !isNaN(end.getTime());
};

export const validatePAN = (pan: string): boolean => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
};

export const validateGST = (gst: string): boolean => {
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gst.toUpperCase());
};
