import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  dnxPrisma?: PrismaClient;
};

export function getPrisma() {
  if (!process.env.DATABASE_URL) {
    throw new Error("PostgreSQL is not configured. Set DATABASE_URL in the deployment environment.");
  }

  if (!globalForPrisma.dnxPrisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    globalForPrisma.dnxPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.dnxPrisma;
}
