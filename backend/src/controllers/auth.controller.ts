import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { TenantService } from '../services/tenant.service';
import { OutboxService } from '../events/outbox.service';
import { asyncHandler } from '../middleware/error.middleware';

async function emitLoginEvent(
  req: Request,
  user: { id: string; email: string },
  authMethod: 'password' | 'local_guest'
) {
  try {
    const tenant = await TenantService.ensurePersonalTenant(user.id, user.email);
    // Non-blocking: enqueue only; never await advisory generation
    void OutboxService.emitLoginSuccess({
      userId: user.id,
      tenantId: tenant.id,
      email: user.email,
      authMethod,
      ip: req.ip,
      userAgent: req.get('user-agent') || undefined
    });
  } catch {
    // Login must succeed even if event infrastructure is down
  }
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  const result = await AuthService.register(email, password, name);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: result
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await AuthService.login(email, password);
  await emitLoginEvent(req, result.user, 'password');

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      ...result,
      advisory: { status: 'preparing', message: 'AI advisory is being prepared' }
    }
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  // In a real application, you might want to blacklist the token
  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  const result = await AuthService.refreshToken(refreshToken);

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: result
  });
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const user = await AuthService.getProfile(userId);

  res.status(200).json({
    success: true,
    data: user
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { name, phone } = req.body;

  const user = await AuthService.updateProfile(userId, { name, phone });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: user
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body;

  const result = await AuthService.changePassword(userId, currentPassword, newPassword);

  res.status(200).json({
    success: true,
    message: result.message
  });
});

/** Local/dev guest session — no password UI required */
export const localGuest = asyncHandler(async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production' && process.env.LOCAL_AUTH_BYPASS !== 'true') {
    res.status(403).json({ success: false, message: 'Local guest auth disabled in production' });
    return;
  }

  const email = process.env.LOCAL_USER_EMAIL || 'local@smarttrade.test';
  const password = process.env.LOCAL_USER_PASSWORD || 'LocalDemo2026!';
  const name = process.env.LOCAL_USER_NAME || 'Local Trader';

  let result;
  try {
    result = await AuthService.login(email, password);
  } catch {
    try {
      result = await AuthService.register(email, password, name);
    } catch {
      result = await AuthService.login(email, password);
    }
  }

  await emitLoginEvent(req, result.user, 'local_guest');

  res.status(200).json({
    success: true,
    message: 'Local guest session ready',
    data: {
      ...result,
      advisory: { status: 'preparing', message: 'AI advisory is being prepared' }
    }
  });
});
