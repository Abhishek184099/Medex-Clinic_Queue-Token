import type { CallRule, WaitingPatient } from "./queue";

export const PATIENT_STATUS = {
  waiting: "waiting",
  inConsultation: "in_consultation",
  done: "done",
  remove: "remove",
} as const;




export interface CalledPatient {
  id: number;
  token: string;
  name: string;
  noShowCount: number;
}

export interface ActiveConsultation {
  doctorId: string;
  token: string;
  name: string;
  age: number;
  checkedInAt: Date;
  appointmentTime: Date | null;
}

export interface CallLogEntry {
  day: string;
  doctorId: string;
  patientId: number;
  token: string;
  name: string;
  rule: CallRule;
  calledAt: Date;
}

export interface QueueTx {
  doctorExists(doctorId: string): Promise<boolean>;
  doctorCount(): Promise<number>;
  currentPatient(doctorId: string): Promise<CalledPatient | null>;
  activeConsultations(): Promise<ActiveConsultation[]>;
  waitingPatients(day: string): Promise<WaitingPatient[]>;
  recentNonEmergencyRules(day: string): Promise<CallRule[]>;
  startConsultation(patientId: number, doctorId: string): Promise<void>;
  finishConsultation(patientId: number): Promise<void>;
  requeueAsWalkIn(patientId: number, checkedInAt: Date): Promise<void>;
  leaveQueue(patientId: number): Promise<void>;
  recordCall(entry: CallLogEntry): Promise<void>;
}

export interface PatientSummary {
  age: number;
  checkedInAt: string;
  appointmentTime: string | null;
}

export interface NowServingEntry extends PatientSummary {
  doctorId: string;
  token: string;
  name: string;
}

export interface WaitingEntry extends PatientSummary {
  position: number;
  token: string;
  name: string;
  estimatedWaitMinutes: number;
}

export interface QueueView {
  nowServing: NowServingEntry[];
  waiting: WaitingEntry[];
}
