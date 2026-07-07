import type { Response } from "express";
import { ZodError } from "zod";

export type ErrorCode =
  | "auth.required"
  | "dev_auth.disabled"
  | "logo_preview.disabled"
  | "logo_preview.invalid_payload"
  | "logo_preview.not_found"
  | "profile.invalid_payload"
  | "request.invalid"
  | "route.not_found"
  | "slug.invalid"
  | "site.invalid_payload"
  | "site.archived"
  | "site.draft_revision_conflict"
  | "site.limit_reached"
  | "site.not_found"
  | "site.permission_denied"
  | "site.publish_invalid"
  | "site.published_slug_locked"
  | "site.slug_unavailable"
  | "site.variant_conflict"
  | "site.version_not_found"
  | "tracking.invalid_context"
  | "tracking.invalid_payload"
  | "tracking.rate_limited"
  | "tracking.unavailable"
  | "workspace.invalid_payload"
  | "workspace.access_denied"
  | "workspace.slug_unavailable"
  | "workspace.website_invalid"
  | "unexpected";

export type ErrorIssue = {
  path: Array<string | number>;
  message: string;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly issues?: ErrorIssue[];

  constructor(input: {
    code: ErrorCode;
    message: string;
    status: number;
    issues?: ErrorIssue[];
  }) {
    super(input.message);
    this.name = "AppError";
    this.code = input.code;
    this.status = input.status;
    this.issues = input.issues;
  }
}

export function issuesFromZodError(error: ZodError): ErrorIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) =>
      typeof segment === "symbol" ? segment.toString() : segment,
    ),
    message: issue.message,
  }));
}

export function sendError(
  response: Response,
  error: AppError,
  requestId: string,
) {
  response.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      requestId,
      ...(error.issues ? { issues: error.issues } : {}),
    },
  });
}
