import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createPrisma(connectionString: string | undefined): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing. Check your .env file.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

