import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { env } from "../src/env";
import { createFileTrackingV2RecordingObjectStore } from "../src/tracking/v2/recording-object-store";
import { createDbTrackingV2Repository } from "../src/tracking/v2/repository";
import {
  createTrackingV2RetentionService,
  TrackingV2RetentionInputError,
} from "../src/tracking/v2/retention";

const scriptDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(scriptDir, "../../../.env"), quiet: true });

async function main() {
  const { db, queryClient } = await import("@lightsite/db");

  try {
    const service = createTrackingV2RetentionService({
      repository: createDbTrackingV2Repository(db),
      recordingObjectStore: resolveRecordingObjectStore(),
    });
    const result = await service.runOnce({
      batchSize: readPositiveIntegerFlag("--batch-size"),
      objectBatchSize: readPositiveIntegerFlag("--object-batch-size"),
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await queryClient.end();
  }
}

function resolveRecordingObjectStore() {
  if (!env.TRACKING_RECORDING_ENABLED || !env.TRACKING_RECORDING_STORAGE_DIR) {
    return null;
  }

  return createFileTrackingV2RecordingObjectStore(env.TRACKING_RECORDING_STORAGE_DIR);
}

function readPositiveIntegerFlag(name: string) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const value = process.argv[index + 1];
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new TrackingV2RetentionInputError(`${name} must be a positive integer.`);
  }

  return parsed;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
