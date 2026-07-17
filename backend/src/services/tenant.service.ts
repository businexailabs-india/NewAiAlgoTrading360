import { prisma } from '../config/database';

/**
 * Ensure every user has exactly one immutable personal tenant + owner membership.
 */
export class TenantService {
  static async ensurePersonalTenant(userId: string, email: string, name?: string | null) {
    const existing = await prisma.tenant.findFirst({
      where: { ownerId: userId, kind: 'personal' },
      include: { memberships: true }
    });
    if (existing) {
      const hasMembership = existing.memberships.some((m: { userId: string }) => m.userId === userId);
      if (!hasMembership) {
        await prisma.tenantMembership.create({
          data: { tenantId: existing.id, userId, role: 'owner' }
        });
      }
      return existing;
    }

    const slug = `personal-${userId.replace(/-/g, '')}`;
    const tenant = await prisma.tenant.create({
      data: {
        name: `${name || email.split('@')[0]} Personal`,
        slug,
        kind: 'personal',
        ownerId: userId,
        memberships: {
          create: { userId, role: 'owner' }
        }
      }
    });
    return tenant;
  }

  static async getPersonalTenantId(userId: string): Promise<string | null> {
    const t = await prisma.tenant.findFirst({
      where: { ownerId: userId, kind: 'personal', isActive: true },
      select: { id: true }
    });
    return t?.id || null;
  }
}
