import { Router } from "express";
import type { QueueViewService } from "../services/queue-view.service";

export function createQueueRouter(service: QueueViewService): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    res.json(await service.getQueue(req.now));
  });

  return router;
}