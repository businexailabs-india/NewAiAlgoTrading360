import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/error.middleware';
import { TenantService } from './tenant.service';

export class AuthService {
  static async register(email: string, password: string, name: string) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new AppError('User already exists', 400);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    await TenantService.ensurePersonalTenant(user.id, user.email, user.name);

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      user,
      accessToken,
      refreshToken
    };
  }

  static async login(email: string, password: string) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Account is inactive', 403);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    await TenantService.ensurePersonalTenant(user.id, user.email, user.name);

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      accessToken,
      refreshToken
    };
  }

  static async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as {
        id: string;
        email: string;
        role: string;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });

      if (!user || !user.isActive) {
        throw new AppError('Invalid refresh token', 401);
      }

      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }
  }

  static generateAccessToken(user: { id: string; email: string; role: string }): string {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as string;
    // @ts-ignore - JWT type mismatch with current @types/jsonwebtoken version
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET!,
      { expiresIn }
    );
  }

  static generateRefreshToken(user: { id: string; email: string; role: string }): string {
    const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new AppError('JWT secrets not configured', 500);
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  static async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true
      }
    });

    return user;
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    return { message: 'Password changed successfully' };
  }
}
