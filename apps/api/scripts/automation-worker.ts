import { db, queryClient } from "@handout/db";
import { AUTOMATION_WORKER_CONCURRENCY } from "@handout/domain";
import { parseAutomationEncryptionKey } from "../src/automations/crypto";
import { createAutomationWorker } from "../src/automations/service";
import { logger } from "../src/lib/logger";

const encryptionKey = process.env.AUTOMATIONS_ENCRYPTION_KEY;
if (process.env.AUTOMATIONS_ENABLED !== "true" || !encryptionKey) {
  throw new Error("Automations are not enabled or AUTOMATIONS_ENCRYPTION_KEY is missing.");
}

const worker = createAutomationWorker(db, {
  encryptionKey: parseAutomationEncryptionKey(encryptionKey),
  allowLocalDestinations: false,
});
let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { stopping = true; });
}

while (!stopping) {
  try {
    const first = await worker.runOnce();
    if (first.retained || first.reconciled || first.fannedOut || first.delivered) {
      await Promise.all(Array.from({ length: AUTOMATION_WORKER_CONCURRENCY }, () => worker.runOnce()));
      continue;
    }
  } catch (error) {
    logger.error("Automation worker tick failed", { error });
  }
  if (!stopping) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}

await queryClient.end({ timeout: 5 });
