export type WebsiteValidationResult =
  | { ok: true; domain: string; url: string }
  | { ok: false; code: WebsiteValidationCode; message: string };

export type WebsiteValidationCode =
  | "website.empty"
  | "website.invalid_url"
  | "website.invalid_hostname"
  | "website.local_hostname"
  | "website.placeholder_domain";

export type NormalizeWebsiteUrlOptions = {
  emptyMessage?: string;
  invalidMessage?: string;
  rejectPlaceholderDomains?: boolean;
  stripPath?: boolean;
};

const PLACEHOLDER_DOMAINS = new Set([
  "company.com",
  "domain.com",
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "yourcompany.com",
]);

const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const SPECIAL_USE_TLDS = new Set(["example", "invalid", "local", "localhost", "test"]);
const INVALID_URL_CHARACTER_PATTERN = /[\s<>"`{}|\\^]/;
const SCHEME_PATTERN = /^[a-z][a-z\d+\-.]*:/i;

export function normalizeWebsiteDomain(input: string): WebsiteValidationResult {
  const result = normalizeWebsiteUrl(input, {
    emptyMessage: "Website is required.",
    invalidMessage: "Enter a valid company website.",
    rejectPlaceholderDomains: true,
    stripPath: true,
  });

  if (!result.ok) {
    if (result.code === "website.local_hostname") {
      return {
        ...result,
        message: "Enter a public company website.",
      };
    }

    if (result.code === "website.invalid_hostname") {
      return {
        ...result,
        message: "Enter a valid public company website domain.",
      };
    }

    if (result.code === "website.placeholder_domain") {
      return {
        ...result,
        message: "Enter your real company website.",
      };
    }

    return result;
  }

  return {
    ok: true,
    domain: result.domain,
    url: `https://${result.domain}`,
  };
}

export function normalizeWebsiteUrl(
  input: string,
  options: NormalizeWebsiteUrlOptions = {}
): WebsiteValidationResult {
  const rawValue = input.trim();
  const invalidMessage = options.invalidMessage ?? "Enter a valid public website URL.";

  if (!rawValue) {
    return {
      ok: false,
      code: "website.empty",
      message: options.emptyMessage ?? "Website URL is required.",
    };
  }

  if (INVALID_URL_CHARACTER_PATTERN.test(rawValue)) {
    return {
      ok: false,
      code: "website.invalid_url",
      message: invalidMessage,
    };
  }

  const urlValue = rawValue.startsWith("//")
    ? `https:${rawValue}`
    : SCHEME_PATTERN.test(rawValue)
      ? rawValue
      : `https://${rawValue}`;

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(urlValue);
  } catch {
    return {
      ok: false,
      code: "website.invalid_url",
      message: invalidMessage,
    };
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return {
      ok: false,
      code: "website.invalid_url",
      message: "Website URL must use http or https.",
    };
  }

  if (parsedUrl.username || parsedUrl.password) {
    return {
      ok: false,
      code: "website.invalid_url",
      message: invalidMessage,
    };
  }

  const domain = parsedUrl.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");

  if (isLocalHostname(domain)) {
    return {
      ok: false,
      code: "website.local_hostname",
      message: "Enter a public website URL.",
    };
  }

  if (!HOSTNAME_PATTERN.test(domain)) {
    return {
      ok: false,
      code: "website.invalid_hostname",
      message: "Enter a valid public website domain.",
    };
  }

  if (options.rejectPlaceholderDomains && PLACEHOLDER_DOMAINS.has(domain)) {
    return {
      ok: false,
      code: "website.placeholder_domain",
      message: "Enter a real website URL.",
    };
  }

  parsedUrl.hostname = domain;
  parsedUrl.username = "";
  parsedUrl.password = "";

  return {
    ok: true,
    domain,
    url: options.stripPath ? `${parsedUrl.protocol}//${parsedUrl.host}` : formatWebsiteUrl(parsedUrl),
  };
}

function isLocalHostname(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.includes(":") ||
    SPECIAL_USE_TLDS.has(hostname.split(".").at(-1) ?? "")
  ) {
    return true;
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);

  if (!ipv4Match) {
    return false;
  }

  const octets = ipv4Match.slice(1).map(Number);

  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return true;
  }

  const [first = 0, second = 0] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first === 169 && second === 254 ||
    first === 172 && second >= 16 && second <= 31 ||
    first === 192 && second === 168
  );
}

function formatWebsiteUrl(url: URL) {
  const path =
    url.pathname === "/" && !url.search && !url.hash
      ? ""
      : url.pathname;

  return `${url.protocol}//${url.host}${path}${url.search}${url.hash}`;
}
