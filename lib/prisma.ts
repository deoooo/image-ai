import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaClient: PrismaClient | undefined = globalForPrisma.prisma;

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: resolveDatabaseUrl() });
  return new PrismaClient({
    adapter,
    log: ["query"],
  });
}

function getPrismaClient() {
  if (!prismaClient) {
    prismaClient = createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = prismaClient;
    }
  }

  return prismaClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
});
