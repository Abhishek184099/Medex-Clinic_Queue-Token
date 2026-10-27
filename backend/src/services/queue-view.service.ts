import { clinicDay } from "../lib/clock";
import type { ClinicSettings } from "../lib/clinic";
import { estimateWait, simulateQueue } from "../contract/queue";
import type { QueueRepository } from "../repositories/queue.repository";
import { QueueView , PatientSummary} from "../contract/queue-tx";



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
      const active = await tx.activeConsultations();
      const doctorCount = await tx.doctorCount();

      const order = simulateQueue(waiting, recentRules, now);
      const minutesPerPatient = this.clinic.averageConsultationMinutes;

      return {
        nowServing: active.map((p) => ({
          doctorId: p.doctorId,
          token: p.token,
          name: p.name,
          ...summary(p),
        })),
        waiting: order.map((p, position) => ({
          position,
          token: p.token,
          name: p.name,
          ...summary(p),
          estimatedWaitMinutes: estimateWait(position, doctorCount, minutesPerPatient),
        })),
      };
    });
  }
}

function summary(p: {
  age: number;
  checkedInAt: Date;
  appointmentTime: Date | null;
}): PatientSummary {
  return {
    age: p.age,
    checkedInAt: p.checkedInAt.toISOString(),
    appointmentTime: p.appointmentTime?.toISOString() ?? null,
  };
}