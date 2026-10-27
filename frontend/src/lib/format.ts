const clinicTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kathmandu",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatClinicTime(iso: string): string {
  return clinicTime.format(new Date(iso));
}
