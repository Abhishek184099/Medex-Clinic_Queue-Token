import { clinicDay } from "../lib/clock";
import type { ClinicSettings } from "../lib/clinic";
import { estimateWait, simulateQueue } from "../contract/queue";
import type { QueueRepository } from "../repositories/queue.repository";

export interface QueueView {
  nowServing: { doctorId: string; token: string; name: string }[];
  waiting: {
    position: number;
    token: string;
    name: string;
    estimatedWaitMinutes: number;
  }[];
}

export class QueueViewService {
  constructor(
    private readonly repo: QueueRepository,
    private readonly clinic: ClinicSettings,
  ) {}

  getQueue(now: Date): Promise<QueueView> {
    return this.repo.readSnapshot(async (tx) => {
      const day = clinicDay(now);
      const waiting = await tx.waitingPatients(day);
      const recentRules = await tx.recentNonEmergencyRules(day);
      const nowServing = await tx.activeConsultations();
      const doctorCount = await tx.doctorCount();

      const order = simulateQueue(waiting, recentRules, now);
      const minutesPerPatient = this.clinic.averageConsultationMinutes;

      return {
        nowServing,
        waiting: order.map((patient, position) => ({
          position,
          token: patient.token,
          name: patient.name,
          estimatedWaitMinutes: estimateWait(position, doctorCount, minutesPerPatient),
        })),
      };
    });
  }
}