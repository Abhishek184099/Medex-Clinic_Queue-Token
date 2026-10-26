import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createPrisma } from "../src/config/db";
import { seedDoctors } from "../src/config/seed";
import { loadExamples, replay } from "./helpers/replay";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const prisma = createPrisma(TEST_DB_URL ?? "postgres://unused");

describe.skipIf(!TEST_DB_URL)("clinic.json example replay", () => {

  const app = createApp({ prisma , allowOverride: true });
  const examples = loadExamples();

  beforeAll(() => seedDoctors(prisma));

  beforeEach(() =>
    prisma.$executeRawUnsafe("TRUNCATE patients, token_counters, call_log RESTART IDENTITY"),
  );

  afterAll(() => prisma.$disconnect());

  examples.forEach((example, index) => {
  it(
    `example ${index + 1} matches tokens, calls and queue snapshots`,
    async () => {
      const actual = await replay(app, example);

      expect(actual.tokens).toEqual(example.expected.tokens);
      expect(actual.calls).toEqual(example.expected.calls);
      expect(actual.queueSnapshots).toEqual(example.expected.queueSnapshots);
    },
    30_000,
  );
});
});