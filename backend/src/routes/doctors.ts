import { Router } from "express";
import type { DoctorQueueService } from "../services/doctor-queue.service";

export function createDoctorRouter(service: DoctorQueueService): Router {
  const router = Router();

  router.post("/:id/call-next", async (req, res) => {
    const result = await service.callNext(req.params.id, req.now);
    res.json(result);
  });

  router.post("/:id/done", async (req, res) => {
    await service.done(req.params.id);
    res.json({ status: "ok" });
  });

  router.post("/:id/no-show", async (req, res) => {
    const result = await service.noShow(req.params.id, req.now);
    res.json(result);
  });

  return router;
}   