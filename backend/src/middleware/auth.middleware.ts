import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    // Local/dev: allow trading without login screen when bypass is enabled
    if (
      (!authHeader || !authHeader.startsWith('Bearer ')) &&
      process.env.LOCAL_AUTH_BYPASS === 'true'
    ) {
      const localUser = await prisma.user.findFirst({
        where: { email: process.env.LOCAL_USER_EMAIL || 'local@smarttrade.test' },
        select: { id: true, email: true, role: true, isActive: true }
      });
      if (localUser?.isActive) {
        req.user = { id: localUser.id, email: localUser.email, role: localUser.role };
        next();
        return;
      }
      res.status(401).json({
        success: false,
        message: 'Local user missing. Call POST /api/auth/local-guest first.'
      });
      return;
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided'
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: string;
        email: string;
        role: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, role: true, isActive: true }
      });

      if (!user || !user.isActive) {
        throw new jwt.JsonWebTokenError('User not found or inactive');
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role
      };

      next();
      return;
    } catch (tokenError) {
      // Local/dev: stale browser tokens should not block the UI
      if (process.env.LOCAL_AUTH_BYPASS === 'true') {
        const localUser = await prisma.user.findFirst({
          where: { email: process.env.LOCAL_USER_EMAIL || 'local@smarttrade.test' },
          select: { id: true, email: true, role: true, isActive: true }
        });
        if (localUser?.isActive) {
          req.user = { id: localUser.id, email: localUser.email, role: localUser.role };
          next();
          return;
        }
      }

      if (tokenError instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          message: 'Token expired'
        });
        return;
      }

      if (tokenError instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
        return;
      }

      throw tokenError;
    }
  } catch (error) {

    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
      role: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true }
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role
      };
    }

    next();
  } catch (error) {
    // If token is invalid, just continue without user
    next();
  }
};
