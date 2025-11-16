import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import * as validators from '../utils/validators';

export const validateRegister = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password, name } = req.body;

  if (!email || !validators.validateEmail(email)) {
    throw new AppError('Invalid email address', 400);
  }

  const passwordValidation = validators.validatePassword(password);
  if (!passwordValidation.valid) {
    throw new AppError(passwordValidation.message || 'Invalid password', 400);
  }

  if (!name || name.trim().length < 2) {
    throw new AppError('Name must be at least 2 characters', 400);
  }

  next();
};

export const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { email, password } = req.body;

  if (!email || !validators.validateEmail(email)) {
    throw new AppError('Invalid email address', 400);
  }

  if (!password || password.length < 6) {
    throw new AppError('Password is required', 400);
  }

  next();
};

export const validateOrder = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { symbol, exchange, tradeType, quantity, price, orderType, product } = req.body;

  if (!symbol || !validators.validateSymbol(symbol)) {
    throw new AppError('Invalid symbol', 400);
  }

  if (!exchange || !validators.validateExchange(exchange)) {
    throw new AppError('Invalid exchange', 400);
  }

  if (!tradeType || !validators.validateTradeType(tradeType)) {
    throw new AppError('Invalid trade type', 400);
  }

  if (!quantity || !validators.validateQuantity(quantity)) {
    throw new AppError('Invalid quantity', 400);
  }

  if (orderType !== 'MARKET' && (!price || !validators.validatePrice(price))) {
    throw new AppError('Invalid price', 400);
  }

  if (!orderType || !validators.validateOrderType(orderType)) {
    throw new AppError('Invalid order type', 400);
  }

  if (!product || !validators.validateProduct(product)) {
    throw new AppError('Invalid product type', 400);
  }

  next();
};

export const validateBrokerConnection = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { broker } = req.params;

  if (!broker || !validators.validateBroker(broker)) {
    throw new AppError('Invalid broker', 400);
  }

  next();
};

export const validateSymbolParam = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { symbol } = req.params;

  if (!symbol || !validators.validateSymbol(symbol)) {
    throw new AppError('Invalid symbol', 400);
  }

  next();
};

export const validateDateRange = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new AppError('Start date and end date are required', 400);
  }

  if (!validators.validateDateRange(startDate as string, endDate as string)) {
    throw new AppError('Invalid date range', 400);
  }

  next();
};

export const validatePagination = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { page, limit } = req.query;

  if (page) {
    const pageNum = parseInt(page as string);
    if (isNaN(pageNum) || pageNum < 1) {
      throw new AppError('Invalid page number', 400);
    }
  }

  if (limit) {
    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new AppError('Invalid limit (must be between 1 and 100)', 400);
    }
  }

  next();
};

export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Sanitize string inputs in body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = validators.sanitizeString(req.body[key]);
      }
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = validators.sanitizeString(req.query[key] as string);
      }
    });
  }

  next();
};
