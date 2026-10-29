import { Prisma , PrismaClient, QueueKind } from "../generated/prisma/client";
import type { CallRule, WaitingPatient } from "../domain/queue";
import  {
  type QueueTx,
  type CalledPatient,
  type ActiveConsultation,
  type CallLogEntry,
  PATIENT_STATUS
} from "../domain/queue-tx";
import { TOKEN_PREFIX } from "../domain/check-in";

export interface IQueueRepository {
  transaction<T>(work: (tx: QueueTx) => Promise<T>): Promise<T>;
  readSnapshot<T>(work: (tx: QueueTx) => Promise<T>): Promise<T>;
}

export class QueueRepository implements IQueueRepository{
    constructor(private readonly prisma : PrismaClient){}

    transaction<T>(work: (tx: QueueTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('clinic-queue'))`;
      return work(createQueueTx(db));
    });
  }

   readSnapshot<T>(work: (tx: QueueTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((db) => work(createQueueTx(db)), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }
}

function createQueueTx(db: Prisma.TransactionClient): QueueTx {
  return {
    async doctorExists(doctorId) {
      const doctor = await db.doctor.findUnique({
        where: { id: doctorId },
        select: { id: true },
      });
      return doctor !== null;
    },

    async doctorCount() {
      return db.doctor.count();
    },

    async currentPatient(doctorId) {
      return db.patient.findFirst({
        where: { doctorId, status: PATIENT_STATUS.inConsultation },
        select: { id: true, token: true, name: true, noShowCount: true },
      });
    },

    async activeConsultations() {
      const rows = await db.patient.findMany({
        where: { status: PATIENT_STATUS.inConsultation },
        select: { doctorId: true, token: true, name: true,age : true, checkedInAt: true, appointmentTime:true },
        orderBy: { doctorId: "asc" },
      });
      return rows.flatMap((row) =>
        row.doctorId ? [{ ...row , doctorId:row.doctorId}] : [],
      );
    },

    async waitingPatients(day) {
      return db.patient.findMany({
        where: { day, status: PATIENT_STATUS.waiting },
        select: {
          id: true,
          token: true,
          name: true,
          age: true,
          queueKind: true,
          appointmentTime: true,
          checkedInAt: true,
        },
      });
    },

    async recentNonEmergencyRules(day) {
      const rows = await db.callLog.findMany({
        where: { day, rule: { not: "emergency" } },
        orderBy: { id: "desc" },
        take: 3,
        select: { rule: true },
      });
      return rows.map((row) => row.rule);
    },

    async startConsultation(patientId, doctorId) {
      await db.patient.update({
        where: { id: patientId },
        data: { status: PATIENT_STATUS.inConsultation, doctorId },
      });
    },

    async finishConsultation(patientId) {
      await db.patient.update({
        where: { id: patientId },
        data: { status: PATIENT_STATUS.done },
      });
    },


    async requeueAsWalkIn(patientId, checkedInAt) {
      await db.patient.update({
        where: { id: patientId },
        data: {
          status: PATIENT_STATUS.waiting,
          queueKind: "walk_in",
          checkedInAt,
          doctorId: null,
          noShowCount: { increment: 1 },
        },
      });
    },

    async leaveQueue(patientId) {
      await db.patient.update({
        where: { id: patientId },
        data: {
          status: PATIENT_STATUS.remove,
          doctorId: null,
          noShowCount: { increment: 1 },
        },
      });
    },

    async recordCall(entry) {
      await db.callLog.create({
        data: {
          day: entry.day,
          doctorId: entry.doctorId,
          patientId: entry.patientId,
          token: entry.token,
          name: entry.name,
          rule: entry.rule,
          calledAt: entry.calledAt,
        },
      });
    },
  };
}