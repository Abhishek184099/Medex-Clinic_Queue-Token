import { clinicDay } from "../lib/clock";
import {
  TOKEN_PREFIX,
  resolveQueueKind,
  CheckInInput,
  CheckInRecord,
  CheckInResult,
} from "../contract/check-in";
import type { CheckInRepository } from "../repositories/check-in.repository";

export class CheckInService {
  constructor(private repo: CheckInRepository) {}

  async checkIn(input: CheckInInput, now: Date): Promise<CheckInResult> {
    const { queueKind, convertedToWalkIn } = resolveQueueKind(input, now);
    const day = clinicDay(now);
    const prefix = TOKEN_PREFIX[queueKind];
    const number = await this.repo.nextTokenNumber(day, prefix);
    const token = `${prefix}-${String(number).padStart(3, "0")}`;

    const record = await this.repo.insert({
      token,
      day,
      name: input.name,
      age: input.age,
      queueKind,
      appointmentTime: input.appointmentTime,
      checkedInAt: now,
    });
    return toResult(record, convertedToWalkIn);
  }
}

function toResult(
  record: CheckInRecord,
  convertedToWalkIn: boolean,
): CheckInResult {
  return {
    token: record.token,
    name: record.name,
    queueKind: record.queueKind,
    convertedToWalkIn,
    checkedInAt: record.checkedInAt.toISOString(),
    appointmentTime: record.appointmentTime?.toISOString() ?? null,
  };
}
