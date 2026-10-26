import { describe, it, expect } from "vitest";
import { parseNowHeader } from "../src/lib/clock";
import { resolveQueueKind } from "../src/contract/check-in";
import { estimateWait ,   noShowOutcome,
  selectNextPatient,
  simulateQueue,
  type CallRule,
  type WaitingPatient,
 } from "../src/contract/queue";

 const at = (value: string): Date => parseNowHeader(value)!;
const NOW = at("2026-11-02T09:00:00+05:45");

function patient(
  overrides: Partial<WaitingPatient> & Pick<WaitingPatient, "id" | "name" | "queueKind" | "checkedInAt">,
): WaitingPatient {
  return { token: `T-${overrides.id}`, age: 30, appointmentTime: null, ...overrides };
}

const walkIn = (id: number, checkedIn: string, age = 30) =>
  patient({ id, name: `W${id}`, queueKind: "walk_in", checkedInAt: at(checkedIn), age });

const appointment = (id: number, appt: string, checkedIn: string) =>
  patient({
    id,
    name: `A${id}`,
    queueKind: "appointment",
    appointmentTime: at(appt),
    checkedInAt: at(checkedIn),
  });

const emergency = (id: number, checkedIn: string) =>
  patient({ id, name: `E${id}`, queueKind: "emergency", checkedInAt: at(checkedIn) });

describe("check-in: late appointments (rule 1)", () => {
  const appt = at("2026-11-02T09:00:00+05:45");
  const input = { kind: "appointment" as const, emergency: false, appointmentTime: appt };

  it("keeps an appointment checked in exactly 15 minutes late", () => {
    expect(resolveQueueKind(input, at("2026-11-02T09:15:00+05:45")).queueKind).toBe("appointment");
  });

  it("converts an appointment more than 15 minutes late into a walk-in", () => {
    const decision = resolveQueueKind(input, at("2026-11-02T09:15:01+05:45"));
    expect(decision).toEqual({ queueKind: "walk_in", convertedToWalkIn: true });
  });
});

describe("selectNextPatient (rule 3)", () => {
  it("returns null when nobody is waiting", () => {
    expect(selectNextPatient([], [], NOW)).toBeNull();
  });

  it("calls emergencies first, even ahead of a due appointment", () => {
    const decision = selectNextPatient(
      [appointment(1, "2026-11-02T09:00:00+05:45", "2026-11-02T08:30:00+05:45"), emergency(2, "2026-11-02T08:55:00+05:45")],
      [],
      NOW,
    );
    expect(decision?.patient.id).toBe(2);
    expect(decision?.rule).toBe("emergency");
  });

  it("calls a due appointment before a walk-in", () => {
    const decision = selectNextPatient(
      [walkIn(1, "2026-11-02T08:00:00+05:45"), appointment(2, "2026-11-02T09:05:00+05:45", "2026-11-02T08:50:00+05:45")],
      [],
      NOW,
    );
    expect(decision?.rule).toBe("due_appointment");
    expect(decision?.patient.id).toBe(2);
  });

  it("treats an appointment exactly 10 minutes away as due, and one 1 ms later as not due", () => {
    const exactly = selectNextPatient(
      [appointment(1, "2026-11-02T09:10:00+05:45", "2026-11-02T08:50:00+05:45"), walkIn(2, "2026-11-02T08:00:00+05:45")],
      [],
      NOW,
    );
    const justAfter = selectNextPatient(
      [appointment(1, "2026-11-02T09:10:00.001+05:45", "2026-11-02T08:50:00+05:45"), walkIn(2, "2026-11-02T08:00:00+05:45")],
      [],
      NOW,
    );
    expect(exactly?.rule).toBe("due_appointment");
    expect(justAfter?.rule).toBe("walk_in");
  });

  it("calls seniors (65 and over) before other walk-ins", () => {
    const decision = selectNextPatient(
      [walkIn(1, "2026-11-02T08:00:00+05:45", 40), walkIn(2, "2026-11-02T08:30:00+05:45", 70), walkIn(3, "2026-11-02T08:10:00+05:45", 65)],
      [],
      NOW,
    );
    expect(decision?.patient.id).toBe(3);
  });

  it("calls an early appointment only when nothing else is waiting", () => {
    const decision = selectNextPatient(
      [appointment(1, "2026-11-02T10:00:00+05:45", "2026-11-02T08:00:00+05:45")],
      [],
      NOW,
    );
    expect(decision?.rule).toBe("early_appointment");
  });
});

describe("fairness (rule 4)", () => {
  const due: CallRule = "due_appointment";
  const queue = [
    appointment(1, "2026-11-02T09:00:00+05:45", "2026-11-02T08:30:00+05:45"),
    walkIn(2, "2026-11-02T08:00:00+05:45"),
  ];

  it("calls a waiting walk-in after three due-appointment calls in a row", () => {
    const decision = selectNextPatient(queue, [due, due, due], NOW);
    expect(decision?.rule).toBe("walk_in");
    expect(decision?.patient.id).toBe(2);
  });

  it("does not trigger after only two due-appointment calls", () => {
    expect(selectNextPatient(queue, [due, due], NOW)?.rule).toBe("due_appointment");
  });

  it("does not trigger when one of the last three calls was a walk-in", () => {
    expect(selectNextPatient(queue, [due, "walk_in", due], NOW)?.rule).toBe("due_appointment");
  });
});

describe("no-show (rule 5)", () => {
  it("requeues on the first no-show and removes on the second", () => {
    expect(noShowOutcome(0)).toBe("requeued");
    expect(noShowOutcome(1)).toBe("remove");
  });
});

describe("queue order and waits (rule 6)", () => {
  it("reproduces the 09:26 queue snapshot from clinic.json", () => {
    const now = at("2026-11-02T09:26:00+05:45");
    const waiting = [
      patient({ id: 4, token: "W-004", name: "Anil", age: 68, queueKind: "walk_in", checkedInAt: at("2026-11-02T09:22:00+05:45") }),
      patient({ id: 2, token: "W-002", name: "Hari", age: 30, queueKind: "walk_in", checkedInAt: at("2026-11-02T08:55:00+05:45") }),
      patient({ id: 3, token: "W-003", name: "Kiran", age: 35, queueKind: "walk_in", checkedInAt: at("2026-11-02T09:18:00+05:45") }),
      patient({ id: 5, token: "A-004", name: "Puja", age: 29, queueKind: "appointment", appointmentTime: at("2026-11-02T09:40:00+05:45"), checkedInAt: at("2026-11-02T09:25:00+05:45") }),
      patient({ id: 6, token: "A-005", name: "Rita", age: 33, queueKind: "appointment", appointmentTime: at("2026-11-02T09:45:00+05:45"), checkedInAt: at("2026-11-02T09:26:00+05:45") }),
    ];
    // Newest first: Gita, Maya and Ram were due appointments, Sita was a walk-in.
    const recent: CallRule[] = ["due_appointment", "due_appointment", "walk_in"];

    const order = simulateQueue(waiting, recent, now);

    expect(order.map((p) => p.token)).toEqual(["W-004", "W-002", "W-003", "A-004", "A-005"]);
    expect(order.map((_p, i) => estimateWait(i, 2, 12))).toEqual([0, 0, 12, 12, 24]);
  });
});