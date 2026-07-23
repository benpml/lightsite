export type WorkEmailValidationResult =
  | { ok: true; email: string; domain: string }
  | { ok: false; code: WorkEmailValidationCode; message: string };

export type EmailValidationResult =
  | { ok: true; email: string; domain: string }
  | { ok: false; code: "email.invalid"; message: string };

export type WorkEmailValidationCode =
  | "email.invalid"
  | "email.plus_addressing_blocked"
  | "email.personal_domain_blocked";

const PERSONAL_EMAIL_DOMAINS = new Set([
  "aol.com",
  "fastmail.com",
  "gmail.com",
  "gmx.com",
  "gmx.net",
  "googlemail.com",
  "hey.com",
  "hotmail.com",
  "hotmail.co.uk",
  "icloud.com",
  "live.com",
  "mail.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "outlook.co.uk",
  "pm.me",
  "proton.me",
  "protonmail.com",
  "protonmail.ch",
  "yahoo.com",
  "yahoo.co.uk",
  "yandex.com",
  "ymail.com",
  "zoho.com",
]);

const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function validateEmail(input: string): EmailValidationResult {
  const email = normalizeEmail(input);

  if (!BASIC_EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      code: "email.invalid",
      message: "Enter a valid email address.",
    };
  }

  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return {
      ok: false,
      code: "email.invalid",
      message: "Enter a valid email address.",
    };
  }

  return { ok: true, email, domain };
}

export function validateWorkEmail(input: string): WorkEmailValidationResult {
  const validation = validateEmail(input);

  if (!validation.ok) return validation;

  const { email, domain } = validation;
  const localPart = email.split("@")[0] ?? "";

  if (localPart.includes("+")) {
    return {
      ok: false,
      code: "email.plus_addressing_blocked",
      message: "Use your work email without a plus alias.",
    };
  }

  if (isPersonalEmailDomain(domain)) {
    return {
      ok: false,
      code: "email.personal_domain_blocked",
      message: "Use your company email to sign up for Handout.",
    };
  }

  return { ok: true, email, domain };
}

export function isPersonalEmailDomain(domain: string) {
  return PERSONAL_EMAIL_DOMAINS.has(domain.trim().toLowerCase());
}
