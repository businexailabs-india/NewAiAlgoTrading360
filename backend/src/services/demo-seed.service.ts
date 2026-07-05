import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { DEMO_USERS } from '../config/demo-users';
import { logger } from '../utils/logger';

export class DemoSeedService {
  static async ensureDemoUsers(): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const demo of DEMO_USERS) {
      const passwordHash = await bcrypt.hash(demo.password, 10);
      const existing = await prisma.user.findUnique({ where: { email: demo.email } });

      if (existing) {
        await prisma.user.update({
          where: { email: demo.email },
          data: {
            name: demo.name,
            role: demo.role,
            passwordHash,
            isActive: true
          }
        });
        updated++;
      } else {
        await prisma.user.create({
          data: {
            email: demo.email,
            name: demo.name,
            role: demo.role,
            passwordHash,
            isActive: true
          }
        });
        created++;
      }
    }

    if (created || updated) {
      logger.info(`Demo users seeded: ${created} created, ${updated} updated`);
    }

    return { created, updated };
  }
}
