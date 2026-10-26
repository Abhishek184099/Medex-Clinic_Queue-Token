export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export const fixedClock =
  (instant: Date): Clock =>
  () =>
    new Date(instant.getTime());

const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

// parseNowHeader parses the x-now header

export function parseNowHeader(value: string): Date | null {
  if (!ISO_WITH_OFFSET.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms);
}

const CLINIC_OFFSET_MS = (5 * 60 + 45) * 60000;

export function clinicDay(instant: Date): string {
  return new Date(instant.getTime() + CLINIC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

// function clinicDate() : string {
//      const now = new Date();
//       return now.toISOString().slice(0,10)
// }
