-- CreateEnum
CREATE TYPE "QueueKind" AS ENUM ('emergency', 'appointment', 'walk_in');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('waiting', 'in_consultation', 'done', 'left_queue');

-- CreateEnum
CREATE TYPE "CallRule" AS ENUM ('emergency', 'due_appointment', 'walk_in', 'early_appointment');

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "queue_kind" "QueueKind" NOT NULL,
    "appointment_time" TIMESTAMPTZ(3),
    "checked_in_at" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "no_show_count" INTEGER NOT NULL DEFAULT 0,
    "doctor_id" TEXT,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_log" (
    "id" SERIAL NOT NULL,
    "day" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rule" "CallRule" NOT NULL,
    "called_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "call_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patients_day_token_key" ON "patients"("day", "token");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_log" ADD CONSTRAINT "call_log_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_log" ADD CONSTRAINT "call_log_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
