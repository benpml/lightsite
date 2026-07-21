import type { Response } from "express";
import { ZodError } from "zod";

export type ErrorCode =
  | "asset.invalid"
  | "asset.invalid_payload"
  | "asset.not_found"
  | "automation.admin_required"
  | "automation.invalid_destination"
  | "automation.invalid_payload"
  | "automation.limit_reached"
  | "automation.not_found"
  | "automation.test_required"
  | "automation.unavailable"
  | "auth.required"
  | "billing.checkout_unavailable"
  | "billing.invalid_payload"
  | "billing.portal_unavailable"
  | "billing.stripe_unavailable"
  | "billing.upgrade_required"
  | "billing.webhook_invalid"
  | "dev_auth.disabled"
  | "extension_auth.invalid_code"
  | "extension_auth.invalid_payload"
  | "logo_preview.disabled"
  | "logo_preview.invalid_payload"
  | "logo_preview.not_found"
  | "account.display_name_invalid"
  | "profile.invalid_payload"
  | "profile.email_in_use"
  | "profile.image_invalid"
  | "profile.image_invalid_payload"
  | "request.invalid"
  | "request.too_large"
  | "route.not_found"
  | "slug.invalid"
  | "site.invalid"
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
  | "team.admin_required"
  | "team.conflict"
  | "team.invalid_email"
  | "team.invalid_payload"
  | "team.not_found"
  | "tracking.invalid_context"
  | "tracking.invalid_payload"
  | "tracking.rate_limited"
  | "tracking.unavailable"
  | "workspace.invalid_payload"
  | "workspace.access_denied"
  | "workspace.name_invalid"
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
