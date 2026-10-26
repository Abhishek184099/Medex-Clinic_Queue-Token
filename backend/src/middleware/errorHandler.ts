import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { AppError } from "../lib/error";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, ...err.details });
  }

  if ((err as { type?: string }).type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
};
