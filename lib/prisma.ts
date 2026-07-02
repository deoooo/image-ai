import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("POSTGRES_URL_NON_POOLING or DATABASE_URL is required");
}

const adapter = new PrismaPg({ connectionString });

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
