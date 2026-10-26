import { clinicDay } from "../lib/clock";
import { QueueKind } from "../contract/check-in";
import { type NoShowOutcome , selectNextPatient, noShowOutcome  } from "../contract/queue";
import { AppError } from "../lib/error";
import { QueueTx , CalledPatient } from "../contract/queue-tx";
import type { QueueRepository } from "../repositories/queue.repository";

export interface CallNextResult {
  patient: { token: string; name: string; queueKind: QueueKind } | null;
}

export interface NoShowResult {
  outcome: NoShowOutcome;
}

export class DoctorQueueService {
  constructor(private readonly repo: QueueRepository) {}

  callNext(doctorId: string, now: Date): Promise<CallNextResult> {
    return this.repo.transaction(async (tx) => {
      await requireDoctor(tx, doctorId);

      if (await tx.currentPatient(doctorId)) {
        throw new AppError(409, "Finish the current patient before calling the next one.");
      }

      const day = clinicDay(now);
      const waiting = await tx.waitingPatients(day);
      const recentRules = await tx.recentNonEmergencyRules(day);
      const decision = selectNextPatient(waiting, recentRules, now);

      if (!decision) return { patient: null };

      const { patient, rule } = decision;
      await tx.startConsultation(patient.id, doctorId);
      await tx.recordCall({
        day,
        doctorId,
        patientId: patient.id,
        token: patient.token,
        name: patient.name,
        rule,
        calledAt: now,
      });

      return {
        patient: {
          token: patient.token,
          name: patient.name,
          queueKind: patient.queueKind,
        },
      };
    });
  }

  done(doctorId: string): Promise<void> {
    return this.repo.transaction(async (tx) => {
      await requireDoctor(tx, doctorId);
      const current = await requireCurrentPatient(tx, doctorId);
      await tx.finishConsultation(current.id);
    });
  }

  noShow(doctorId: string, now: Date): Promise<NoShowResult> {
    return this.repo.transaction(async (tx) => {
      await requireDoctor(tx, doctorId);
      const current = await requireCurrentPatient(tx, doctorId);

      const outcome = noShowOutcome(current.noShowCount);
      if (outcome === "requeued") {
        await tx.requeueAsWalkIn(current.id, now);
      } else {
        await tx.leaveQueue(current.id);
      }

      return { outcome };
    });
  }
}

async function requireDoctor(tx: QueueTx, doctorId: string): Promise<void> {
  if (!(await tx.doctorExists(doctorId))) {
    throw new AppError(404, "Doctor not found.");
  }
}

async function requireCurrentPatient(
  tx: QueueTx,
  doctorId: string,
): Promise<CalledPatient> {
  const current = await tx.currentPatient(doctorId);
  if (!current) {
    throw new AppError(409, "You are not seeing a patient.");
  }
  return current;
}