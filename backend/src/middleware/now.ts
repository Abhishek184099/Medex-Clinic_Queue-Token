import type { NextFunction, Request, Response } from "express";
import { parseNowHeader, type Clock } from "../lib/clock";
import { AppError } from "../lib/error";

declare global {
  namespace Express {
    interface Request {
      now: Date;
    }
  }
}

interface NowOptions {
  clock: Clock;
  allowOverride: boolean;
}

export function nowMiddleware({ clock, allowOverride }: NowOptions) {
  return function now(req: Request, res: Response, next: NextFunction) {
    const header = req.header("X-Now");
    if (allowOverride && header !== undefined) {
      const parsed = parseNowHeader(header);
      if (!parsed) {
        throw new AppError(
          400,
          "X-Now must be an ISO 8601 time with an offset, e.g. 2026-11-02T09:30:00+05:45",
        );
      }
      req.now = parsed;
    } else {
      req.now = clock();
    }

    next();
  };
}
