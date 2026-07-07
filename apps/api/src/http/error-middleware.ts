import type { NextFunction, Request, Response } from "express";
import { AppError, sendError } from "./errors";
import { logger } from "../lib/logger";

export function notFoundMiddleware(request: Request, _response: Response, next: NextFunction) {
  next(
    new AppError({
      code: "route.not_found",
      message: `No route found for ${request.method} ${request.path}.`,
      status: 404,
    }),
  );
}

export function errorMiddleware(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
) {
  const requestId = request.context?.requestId ?? "unknown";

  if (error instanceof AppError) {
    sendError(response, error, requestId);
    return;
  }

  if (isJsonParseError(error)) {
    sendError(
      response,
      new AppError({
        code: "request.invalid",
        message: "Invalid JSON request body.",
        status: 400,
      }),
      requestId,
    );
    return;
  }

  logger.error("Unhandled API error", { error, requestId });

  sendError(
    response,
    new AppError({
      code: "unexpected",
      message: "Something went wrong.",
      status: 500,
    }),
    requestId,
  );
}

function isJsonParseError(error: unknown) {
  if (!(error instanceof SyntaxError) || typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { status?: unknown; type?: unknown; body?: unknown };
  return candidate.status === 400 && candidate.type === "entity.parse.failed" && "body" in candidate;
}
