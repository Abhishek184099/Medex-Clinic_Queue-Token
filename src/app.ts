import express from "express";
import { systemClock, type Clock } from "./lib/clock";
import { errorHandler } from "./middleware/errorHandler";
import { nowMiddleware } from "./middleware/now";
import { createCheckInRouter } from "./routes/check-in";
import { checkInService } from "./services";
import { boolean } from "zod";

export interface AppOptions {
  allowOverride: boolean;
  clock?: Clock;
}

export function createApp({ allowOverride, clock = systemClock }: AppOptions) {
  const app = express();

  app.use(express.json);
  app.use(nowMiddleware({ clock, allowOverride }));
  app.use("/api/check-ins", createCheckInRouter(checkInService));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  app.use(errorHandler);

  return app;
}
