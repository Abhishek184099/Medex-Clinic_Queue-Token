import "dotenv/config"
import { createApp } from "./app";
import { createPrisma } from "./config/db";
import { seedDoctors } from "./config/seed";

async function main() {

  const prisma = createPrisma(process.env.DATABASE_URL);
  await seedDoctors(prisma);

  const app = createApp({ prisma  , allowOverride : process.env.NODE_ENV !== "production" });

  app.listen(process.env.PORT, () => {
    console.log(`API listening on http://localhost:${process.env.PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});