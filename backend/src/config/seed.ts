import { readFile } from "node:fs/promises";
import type{ PrismaClient } from "../generated/prisma/client";
import { CLINIC_FILE } from "../lib/clinic";

interface ClinicFile {
  clinic: {
    doctors: { id: string; name: string }[];
  };
}
export async function seedDoctors(
  prisma: PrismaClient,
  file = CLINIC_FILE,
): Promise<number> {
  const raw = JSON.parse(await readFile(file, "utf8")) as ClinicFile;
  const doctors = raw.clinic?.doctors ?? [];

  if (doctors.length === 0) {
    throw new Error(`No doctors found in ${file}`);
  }

  await prisma.$transaction(
    doctors.map((doctor) =>
      prisma.doctor.upsert({
        where: { id: doctor.id },
        create: doctor,
        update: { name: doctor.name },
      }),
    ),
  );

  return doctors.length;
}