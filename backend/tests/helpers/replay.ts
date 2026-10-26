import { readFileSync } from "node:fs";
import type { Express } from "express";
import request from "supertest";
import { CLINIC_FILE } from "../../src/lib/clinic";

export type ReplayEvent =
  | {
      at: string;
      type: "check_in";
      patient: {
        name: string;
        age: number;
        kind: "appointment" | "walk_in";
        emergency?: boolean;
        appointmentTime?: string;
      };
    }
  | { at: string; type: "call_next" | "done" | "no_show"; doctorId: string }
  | { at: string; type: "queue" };

export interface QueueRow {
  position: number;
  token: string;
  name: string;
  estimatedWaitMinutes: number;
}

export interface CallRow {
  at: string;
  doctorId: string;
  token: string | null;
  name: string | null;
}

export interface ReplayExample {
  events: ReplayEvent[];
  expected: {
    tokens: Record<string, string>;
    calls: CallRow[];
    queueSnapshots: { at: string; queue: QueueRow[] }[];
  };
}

export function loadExamples(file = CLINIC_FILE): ReplayExample[] {
  return JSON.parse(readFileSync(file, "utf8")).examples;
}

const hhmm = (iso: string): string => iso.slice(11, 16);

const DOCTOR_PATH = { call_next: "call-next", done: "done", no_show: "no-show" } as const;

export async function replay(app: Express, example: ReplayExample) {
  const tokens: Record<string, string> = {};
  const calls: CallRow[] = [];
  const queueSnapshots: { at: string; queue: QueueRow[] }[] = [];

  for (const event of example.events) {
    switch (event.type) {
      case "check_in": {
        const res = await request(app)
          .post("/api/check-ins")
          .set("X-Now", event.at)
          .send(event.patient);
        expectStatus(res, 201, event);
        tokens[event.patient.name] = res.body.token;
        break;
      }
      case "call_next": {
        const res = await request(app)
          .post(`/api/doctors/${event.doctorId}/${DOCTOR_PATH.call_next}`)
          .set("X-Now", event.at);
        expectStatus(res, 200, event);
        calls.push({
          at: hhmm(event.at),
          doctorId: event.doctorId,
          token: res.body.patient?.token ?? null,
          name: res.body.patient?.name ?? null,
        });
        break;
      }
      case "done":
      case "no_show": {
        const res = await request(app)
          .post(`/api/doctors/${event.doctorId}/${DOCTOR_PATH[event.type]}`)
          .set("X-Now", event.at);
        expectStatus(res, 200, event);
        break;
      }
      case "queue": {
        const res = await request(app).get("/api/queue").set("X-Now", event.at);
        expectStatus(res, 200, event);
        queueSnapshots.push({ at: event.at, queue: res.body.waiting });
        break;
      }
    }
  }

  return { tokens, calls, queueSnapshots };
}

function expectStatus(res: { status: number; body: unknown }, expected: number, event: ReplayEvent) {
  if (res.status !== expected) {
    throw new Error(
      `${event.type} at ${event.at} returned ${res.status} (expected ${expected}): ${JSON.stringify(res.body)}`,
    );
  }
}
