import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const ORIGIN_AUTH_HEADER = "x-handout-origin-auth";

export function createOriginAuthMiddleware(secret: string | undefined) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (request.path === "/api/health" || !secret) {
      next();
      return;
    }
    const suppliedBytes = Buffer.from(request.get(ORIGIN_AUTH_HEADER) ?? "");
    const expectedBytes = Buffer.from(secret);
    if (
      suppliedBytes.byteLength !== expectedBytes.byteLength ||
      !timingSafeEqual(suppliedBytes, expectedBytes)
    ) {
      response.status(403).setHeader("cache-control", "no-store").end();
      return;
    }
    next();
  };
}
