import { type QueueKind } from "../generated/prisma/enums";

export type CallRule =
  | "emergency"
  | "due_appointment"
  | "walk_in"
  | "early_appointment";

export interface WaitingPatient {
  id: number;
  token: string;
  name: string;
  age: number;
  queueKind: QueueKind;
  appointmentTime: Date | null;
  checkedInAt: Date;
}

export type NoShowOutcome = "requeued" | "remove";

export interface CallDecision {
  patient: WaitingPatient;
  rule: CallRule;
}

const DUE_WINDOW_MS = 10 * 60000;
const SENIOR_AGE = 65;
const FAIRNESS_WINDOW = 3;

export function selectNextPatient(
  waiting: WaitingPatient[],
  recentRules: CallRule[],
  now: Date,
): CallDecision | null {
  const emergencies = ofKind(waiting, "emergency").sort(byCheckIn);
  if (emergencies.length > 0) return decide(emergencies[0], "emergency");

  const appointments = ofKind(waiting, "appointment").sort(
    byAppointmentThenCheckIn,
  );
  const dueCutoff = now.getTime() + DUE_WINDOW_MS;
  const due = appointments.filter((p) => appointmentMs(p) <= dueCutoff);
  const walkIns = ofKind(waiting, "walk_in").sort(bySeniority);

  if (walkIns.length > 0 && isFairnessDue(recentRules)) {
    return decide(walkIns[0], "walk_in");
  }

  if (due.length > 0) return decide(due[0], "due_appointment");

  if (walkIns.length > 0) return decide(walkIns[0], "walk_in");

  if (appointments.length > 0)
    return decide(appointments[0], "early_appointment");

  return null;
}

export function noShowOutcome(previousNoShows: number): NoShowOutcome {
  return previousNoShows === 0 ? "requeued" : "remove";
}

export function simulateQueue(
  waiting: WaitingPatient[],
  recentRules: CallRule[],
  now: Date,
): WaitingPatient[] {
  const remaining = [...waiting];
  const order: WaitingPatient[] = [];
  let recent = recentRules;

  while (remaining.length > 0) {
    const decision = selectNextPatient(remaining, recent, now);
    if (!decision) break;

    order.push(decision.patient);
    remaining.splice(remaining.indexOf(decision.patient), 1);
    recent = recordRule(recent, decision.rule);
  }

  return order;
}

export function estimateWait(
  position: number,
  doctorCount: number,
  minutesPerPatient: number,
): number {
  return Math.floor(position / doctorCount) * minutesPerPatient;
}

function recordRule(recent: CallRule[], rule: CallRule): CallRule[] {
  if (rule === "emergency") return recent;
  return [rule, ...recent].slice(0, FAIRNESS_WINDOW);
}

function isFairnessDue(recentRules: CallRule[]): boolean {
  return (
    recentRules.length >= FAIRNESS_WINDOW &&
    recentRules
      .slice(0, FAIRNESS_WINDOW)
      .every((rule) => rule === "due_appointment")
  );
}

function decide(patient: WaitingPatient, rule: CallRule): CallDecision {
  return { patient, rule };
}

function ofKind(patients: WaitingPatient[], kind: QueueKind): WaitingPatient[] {
  return patients.filter((p) => p.queueKind === kind);
}

function byCheckIn(a: WaitingPatient, b: WaitingPatient): number {
  return a.checkedInAt.getTime() - b.checkedInAt.getTime() || a.id - b.id;
}

function bySeniority(a: WaitingPatient, b: WaitingPatient): number {
  const seniority = (p: WaitingPatient) => (p.age >= SENIOR_AGE ? 1 : 0);
  return seniority(b) - seniority(a) || byCheckIn(a, b);
}

function appointmentMs(patient: WaitingPatient): number {
  return patient.appointmentTime?.getTime() ?? Number.POSITIVE_INFINITY;
}

function byAppointmentThenCheckIn(
  a: WaitingPatient,
  b: WaitingPatient,
): number {
  return appointmentMs(a) - appointmentMs(b) || byCheckIn(a, b);
}
