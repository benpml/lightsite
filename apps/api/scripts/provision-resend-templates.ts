import { getResendTemplateDefinitions } from "../src/email/resend-template-definitions";

const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.EMAIL_FROM?.trim() || "Handout <noreply@handout.link>";

if (!apiKey) {
  throw new Error("RESEND_API_KEY is required to provision templates.");
}

const existingResponse = await resendRequest("/templates?limit=100", { method: "GET" });
const existing = existingResponse as {
  data?: Array<{ id: string; alias: string | null }>;
};

for (const definition of getResendTemplateDefinitions(from)) {
  const current = existing.data?.find((template) => template.alias === definition.alias);
  const path = current ? `/templates/${current.id}` : "/templates";
  const method = current ? "PATCH" : "POST";
  const result = await resendRequest(path, {
    method,
    body: JSON.stringify(definition),
  }) as { id: string };

  await resendRequest(`/templates/${result.id}/publish`, { method: "POST" });
  console.info(`${current ? "Updated" : "Created"} and published ${definition.alias}`);
}

async function resendRequest(path: string, init: RequestInit) {
  const response = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Resend request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  return body ? JSON.parse(body) as unknown : {};
}
