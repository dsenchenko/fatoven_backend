import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, isAppError } from "./errors";

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "validation_error",
      message: "Invalid request data",
      details: error.flatten(),
    });
    return;
  }

  if (isAppError(error)) {
    res.status(error.statusCode).json({
      error: error.code ?? "app_error",
      message: error.message,
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: "internal_error",
    message: "Something went wrong",
  });
}
