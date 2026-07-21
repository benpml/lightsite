export type ResendConfig = {
  apiKey?: string;
  from: string;
  nodeEnv: "development" | "test" | "production";
};

export type ResendTemplateVariables = Record<string, string | number>;

export type SendResendTemplateInput = {
  to: string;
  template: string;
  variables: ResendTemplateVariables;
  idempotencyKey?: string;
};

export type ResendTemplateSender = (
  input: SendResendTemplateInput,
) => Promise<{ id: string | null }>;

export function createResendTemplateSender(config: ResendConfig): ResendTemplateSender {
  return async (input) => {
    if (!config.apiKey) {
      if (config.nodeEnv === "production") {
        throw new Error("Email delivery is not configured.");
      }

      console.info(`[handout email] ${input.template} -> ${input.to}`);
      return { id: null };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
        ...(input.idempotencyKey
          ? { "idempotency-key": input.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        template: {
          id: input.template,
          variables: input.variables,
        },
      }),
    });

    const body = await response.text();

    if (!response.ok) {
      throw new Error(`Email delivery failed (${response.status}): ${body.slice(0, 240)}`);
    }

    const result = JSON.parse(body) as { id?: string };
    return { id: result.id ?? null };
  };
}
