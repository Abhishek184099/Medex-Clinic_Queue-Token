import { seedDoctors } from "../config/seed";

import { createPrisma } from "../config/db";

const prisma = createPrisma(process.env.DATABASE_URL);


seedDoctors(prisma)
  .then((count) => console.log(`Seeded ${count} doctors`))
  .catch((err) => {
    console.error("Seed failed", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());