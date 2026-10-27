import { formatClinicTime } from "../lib/format";
import type { PatientSummary } from "../api/clinic";

export function PatientDetails({ patient }: { patient: PatientSummary }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm text-slate-600">
      <dt>Age</dt>
      <dd className="font-medium text-slate-800">{patient.age}</dd>

      <dt>Checked in</dt>
      <dd className="font-medium text-slate-800">{formatClinicTime(patient.checkedInAt)}</dd>

      <dt>Appointment</dt>
      <dd className="font-medium text-slate-800">
        {patient.appointmentTime ? formatClinicTime(patient.appointmentTime) : "Walk-in"}
      </dd>
    </dl>
  );
}