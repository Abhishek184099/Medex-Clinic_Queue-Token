import type { RequestHandler } from "express";
import type { z } from "zod";
import { AppError } from "../lib/error";

export function formatErrors(
  issues: z.core.$ZodIssue[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "body";
    errors[key] ??= issue.message;
  }
  return errors;
}

export function validate(
  schema: z.ZodType,
  message = "Invalid request.",
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        new AppError(400, message, {
          fields: formatErrors(result.error.issues),
        }),
      );
    }
    req.body = result.data;
    next();
  };
}
