import { readFileSync } from "node:fs";
import path from "node:path";

export const CLINIC_FILE = path.resolve(process.cwd(), "data/clinic.json");

export interface ClinicSettings {
  averageConsultationMinutes: number;
}

interface ClinicFile {
  clinic: { averageConsultationMinutes: number };
}

export function loadClinicSettings(file = CLINIC_FILE): ClinicSettings {
  const { clinic } = JSON.parse(readFileSync(file, "utf8")) as ClinicFile;

  if (!Number.isFinite(clinic?.averageConsultationMinutes)) {
    throw new Error(`averageConsultationMinutes is missing in ${file}`);
  }

  return { averageConsultationMinutes: clinic.averageConsultationMinutes };
}