import express from "express";
import { systemClock, type Clock } from "./lib/clock";
import { errorHandler } from "./middleware/errorHandler";
import { nowMiddleware } from "./middleware/now";
import { createCheckInRouter } from "./routes/check-in";
import { QueueViewService } from "./services/queue-view.service";
import { QueueRepository } from "./repositories/queue.repository";
import { createQueueRouter } from "./routes/queue";
import { createDoctorRouter } from "./routes/doctors";
import { type ClinicSettings, loadClinicSettings } from "./lib/clinic";
import type{ PrismaClient } from "./generated/prisma/client";
import { CheckInService } from "./services/check-in.service";
import { DoctorQueueService } from "./services/doctor-queue.service";
import { CheckInRepository } from "./repositories/check-in.repository";

export interface AppOptions {
  prisma: PrismaClient;
  allowOverride: boolean;
  clock?: Clock;
  clinic?: ClinicSettings;
}

export function createApp({
  prisma,
  allowOverride,
  clock = systemClock,
  clinic = loadClinicSettings(),
}: AppOptions) {
  const app = express();

  const queueRepo = new QueueRepository(prisma);
  const checkInService = new CheckInService(
    new CheckInRepository(prisma),
  );
  const doctorQueueService = new DoctorQueueService(queueRepo);
  const queueViewService = new QueueViewService(queueRepo, clinic);


  app.use(express.json());
  app.use(nowMiddleware({ clock, allowOverride }));
  app.use("/api/check-ins", createCheckInRouter(checkInService));
  app.use("/api/doctors", createDoctorRouter(doctorQueueService));
  app.use("/api/queue", createQueueRouter(queueViewService));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  app.use(errorHandler);

  return app;
}
