import { z } from "zod";
import { parseNowHeader } from "../lib/clock";
import type { CheckInInput } from "../contract/check-in";

export const checkInSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(100),
    age: z.number().int().min(0).max(120),
    kind: z.enum(["appointment", "walk_in"]),
    emergency: z.boolean().default(false),
    appointmentTime: z.iso
      .datetime({ offset: true })
      .optional()
      .nullable()
      .transform((value) => (value ? parseNowHeader(value) : null)),
  })
  .refine(
    (data) =>
      !(
        data.kind == "appointment" &&
        !data.emergency &&
        data.appointmentTime === null
      ),
    {
      path: ["appointmentTime"],
      message: "Appointment time is required for appointments.",
    },
  )
  .refine(
    (data) => !(data.kind === "walk_in" && data.appointmentTime !== null),
    {
      path: ["appointmentTime"],
      message: "Walk-ins cannot have an appointment time.",
    },
  );

export type CheckInRequest = z.output<typeof checkInSchema>;
