/**
 * Platform Seed — creates the superadmin platform user.
 *
 * Usage:
 *   npx ts-node --project tsconfig.seed.json prisma/seed.ts
 *
 * Idempotent: creates or updates the seeded user so the documented credentials work.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPERADMIN_EMAIL ?? 'superadmin@deltra.id';
  const username = process.env.SUPERADMIN_USERNAME ?? 'superadmin';
  const password = process.env.SUPERADMIN_PASSWORD ?? 'superadmin123';
  const fullName = process.env.SUPERADMIN_FULLNAME ?? 'Super Admin';

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.platformUser.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existing) {
    const user = await prisma.platformUser.update({
      where: { id: existing.id },
      data: {
        email,
        username,
        fullName,
        passwordHash,
        role: 'superadmin',
        status: 'active',
        deletedAt: null,
      },
    });

    console.log(`[seed] Superadmin updated: ${user.email} (id: ${user.id})`);
    console.log(`[seed] Login with identifier="${username}" and password="${password}"`);
    return;
  }

  const user = await prisma.platformUser.create({
    data: {
      email,
      username,
      fullName,
      passwordHash,
      role: 'superadmin',
      status: 'active',
    },
  });

  console.log(`[seed] Superadmin created: ${user.email} (id: ${user.id})`);
  console.log(`[seed] Login with identifier="${username}" and password="${password}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
