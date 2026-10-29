import type { PrismaClient } from "../generated/prisma/client";
import type { CheckInRecord, TokenPrefix } from "../domain/check-in";

export interface NewCheckIn extends CheckInRecord {
  day: string;
}

export interface CheckInRepository {
  insert(record: NewCheckIn): Promise<CheckInRecord>;
  nextTokenNumber(day: string, prefix: TokenPrefix): Promise<number>;
}

export class CheckInRepository implements CheckInRepository {
  constructor(private readonly prisma: PrismaClient) {}

  insert(record: NewCheckIn): Promise<CheckInRecord> {
    return this.prisma.patient.create({
      data: {
        token: record.token,
        day: record.day,
        name: record.name,
        age: record.age,
        queueKind: record.queueKind,
        appointmentTime: record.appointmentTime,
        checkedInAt: record.checkedInAt,
      },
      select: {
        token: true,
        name: true,
        age: true,
        queueKind: true,
        appointmentTime: true,
        checkedInAt: true,
      },
    });
  }

  async nextTokenNumber(day: string, prefix: TokenPrefix): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ lastNumber: number }[]>`
      INSERT INTO token_counters (day , prefix , last_number)
      VALUES (${day} , ${prefix} , 1)
      ON CONFLICT (day , prefix)
      DO UPDATE SET last_number = token_counters.last_number + 1
      RETURNING last_number AS "lastNumber";
    `;
    return row.lastNumber;
  }
}
