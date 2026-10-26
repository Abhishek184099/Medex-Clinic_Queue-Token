import { Router } from "express";
import { validate } from "../middleware/validate";
import { checkInSchema, type CheckInRequest } from "../validation/check-in";
import type { CheckInService } from "../services/check-in.service";

export function createCheckInRouter(service: CheckInService): Router {
  const router = Router();

  router.post(
    "/",
    validate(checkInSchema, "invalid check-in"),
    async (req, res) => {
      const input = req.body as CheckInRequest;
      const result = await service.checkIn(input, req.now);
      res.status(201).json(result);
    },
  );
  return router;
}
