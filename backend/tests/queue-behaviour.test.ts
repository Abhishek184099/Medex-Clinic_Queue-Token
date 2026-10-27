import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createPrisma } from "../src/config/db";
import { seedDoctors } from "../src/config/seed";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const prisma = createPrisma(TEST_DB_URL ?? "postgres://unused");

const t = (hhmm: string) => `2026-11-02T${hhmm}:00+05:45`;

describe.skipIf(!TEST_DB_URL)("queue behaviour against Postgres", () => {
  const app = createApp({ prisma, allowOverride: true });

  beforeAll(() => seedDoctors(prisma));

  beforeEach(() =>
    prisma.$executeRawUnsafe("TRUNCATE patients, token_counters, call_log RESTART IDENTITY"),
  );

  afterAll(() => prisma.$disconnect());

  const checkIn = (at: string, body: object) =>
    request(app).post("/api/check-ins").set("X-Now", at).send(body);

  const walkIn = (at: string, name: string, age = 30) =>
    checkIn(at, { name, age, kind: "walk_in" });

  const appointment = (checkedInAt: string, name: string, appointmentTime: string) =>
    checkIn(checkedInAt, { name, age: 30, kind: "appointment", appointmentTime });

  const emergency = (at: string, name: string) =>
    checkIn(at, { name, age: 30, kind: "walk_in", emergency: true });

  const act = (at: string, doctorId: string, action: "call-next" | "done" | "no-show") =>
    request(app).post(`/api/doctors/${doctorId}/${action}`).set("X-Now", at);

  const waitingNames = async (at: string): Promise<string[]> => {
    const res = await request(app).get("/api/queue").set("X-Now", at);
    return res.body.waiting.map((p: { name: string }) => p.name);
  };

    describe("fairness window ignores emergencies (rule 4)", () => {
    it("still calls a walk-in after three due calls when an emergency was called in between", async () => {
      await walkIn(t("08:00"), "Walk");
      await appointment(t("08:30"), "A1", t("09:00"));
      await appointment(t("08:31"), "A2", t("09:00"));
      await appointment(t("08:32"), "A3", t("09:00"));
      await appointment(t("08:33"), "A4", t("09:00"));

      const names: string[] = [];
      const callAndFinish = async (at: string) => {
        const res = await act(t(at), "D1", "call-next");
        expect(res.status).toBe(200);
        names.push(res.body.patient.name);
        await act(t(at), "D1", "done");
      };

      await callAndFinish("09:00"); 
      await callAndFinish("09:01"); 

      await emergency(t("09:02"), "E1");
      await callAndFinish("09:02"); // E1

      await callAndFinish("09:03"); // A3: only two non-emergency calls came before it
      await callAndFinish("09:04"); // Walk: the last three non-emergency calls were all due

      // If E1 were counted in the window, A4 would be called here instead of the walk-in.
      expect(names).toEqual(["A1", "A2", "E1", "A3", "Walk"]);
    });

    it("does not trigger fairness when only two non-emergency calls were due", async () => {
      await walkIn(t("08:00"), "Walk");
      await appointment(t("08:30"), "A1", t("09:00"));
      await appointment(t("08:31"), "A2", t("09:00"));
      await appointment(t("08:32"), "A3", t("09:00"));

      const names: string[] = [];
      const callAndFinish = async (at: string) => {
        const res = await act(t(at), "D1", "call-next");
        expect(res.status).toBe(200);
        names.push(res.body.patient.name);
        await act(t(at), "D1", "done");
      };

      await callAndFinish("09:00"); // A1
      await callAndFinish("09:01"); // A2

      await emergency(t("09:02"), "E1");
      await callAndFinish("09:02"); // E1

      // Only A1 and A2 are in the window, so fairness doesn't trigger and A3 is due.
      await callAndFinish("09:03"); // A3

      expect(names).toEqual(["A1", "A2", "E1", "A3"]);
    });
  });

  describe("no-show (rule 5)", () => {
    it("sends a first no-show to the back of the walk-in queue and keeps the token", async () => {
      await walkIn(t("08:00"), "Ram");
      await walkIn(t("08:30"), "Sita");

      await act(t("08:45"), "D1", "call-next");
      const noShow = await act(t("08:50"), "D1", "no-show");
      expect(noShow.body).toEqual({ outcome: "requeued" });

      // Ram's check-in time is now 08:50, so Sita (08:30) is ahead of him.
      expect(await waitingNames(t("08:51"))).toEqual(["Sita", "Ram"]);

      const sita = await act(t("08:51"), "D2", "call-next");
      expect(sita.body.patient).toMatchObject({ token: "W-002", name: "Sita" });
      await act(t("08:52"), "D2", "done");

      // Ram comes back with his original token, W-001.
      const ram = await act(t("08:53"), "D1", "call-next");
      expect(ram.body.patient).toMatchObject({ token: "W-001", name: "Ram" });
    });

    it("removes the patient from the queue on a second no-show", async () => {
      await walkIn(t("08:00"), "Ram");

      await act(t("08:05"), "D1", "call-next");
      expect((await act(t("08:10"), "D1", "no-show")).body).toEqual({ outcome: "requeued" });

      await act(t("08:15"), "D1", "call-next");
      expect((await act(t("08:20"), "D1", "no-show")).body).toEqual({ outcome: "remove" });

      expect(await waitingNames(t("08:21"))).toEqual([]);
      expect((await act(t("08:21"), "D1", "call-next")).body).toEqual({ patient: null });
    });
  });

  describe("concurrency", () => {
    it("never gives one patient to two doctors who press at the same moment", async () => {
      await walkIn(t("08:00"), "Ram");
      await walkIn(t("08:01"), "Sita");

      const [first, second] = await Promise.all([
        act(t("08:30"), "D1", "call-next"),
        act(t("08:30"), "D2", "call-next"),
      ]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body.patient.token).not.toBe(second.body.patient.token);
    });

    it("lets each doctor hold one patient when every doctor presses several times at once", async () => {
      for (const [i, name] of ["Ram", "Sita", "Hari", "Gita"].entries()) {
        await walkIn(t(`08:0${i}`), name);
      }

      const results = await Promise.all([
        ...Array.from({ length: 3 }, () => act(t("08:30"), "D1", "call-next")),
        ...Array.from({ length: 3 }, () => act(t("08:30"), "D2", "call-next")),
      ]);

      const called = results
        .filter((r) => r.status === 200 && r.body.patient !== null)
        .map((r) => r.body.patient.token);

      expect(called).toHaveLength(2);
      expect(new Set(called).size).toBe(2);

      expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    });
  });
});