import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type TrackingV2RecordingObject = {
  body: Buffer;
  contentType: string;
};

export interface TrackingV2RecordingObjectStore {
  putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void>;
  getObject(key: string): Promise<TrackingV2RecordingObject | null>;
  deleteObject(key: string): Promise<void>;
}

export function createMemoryTrackingV2RecordingObjectStore(): TrackingV2RecordingObjectStore & {
  objects: Map<string, TrackingV2RecordingObject>;
} {
  const objects = new Map<string, TrackingV2RecordingObject>();

  return {
    objects,
    async putObject(input) {
      objects.set(input.key, {
        body: Buffer.from(input.body),
        contentType: input.contentType,
      });
    },
    async getObject(key) {
      const object = objects.get(key);
      return object
        ? {
            body: Buffer.from(object.body),
            contentType: object.contentType,
          }
        : null;
    },
    async deleteObject(key) {
      objects.delete(key);
    },
  };
}

export function createFileTrackingV2RecordingObjectStore(rootDirectory: string): TrackingV2RecordingObjectStore {
  const root = path.resolve(rootDirectory);

  return {
    async putObject(input) {
      const objectPath = resolveObjectPath(root, input.key);
      await mkdir(path.dirname(objectPath), { recursive: true });
      await writeFile(objectPath, input.body);
    },
    async getObject(key) {
      const objectPath = resolveObjectPath(root, key);

      try {
        const body = await readFile(objectPath);
        return {
          body,
          contentType: isGzip(body)
            ? "application/gzip"
            : "application/json; charset=utf-8",
        };
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") {
          return null;
        }

        throw error;
      }
    },
    async deleteObject(key) {
      const objectPath = resolveObjectPath(root, key);

      try {
        await unlink(objectPath);
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") {
          return;
        }

        throw error;
      }
    },
  };
}

function isGzip(body: Buffer) {
  return body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b;
}

function resolveObjectPath(root: string, key: string) {
  const relative = key
    .split("/")
    .filter((part) => part.length > 0 && part !== "." && part !== "..")
    .join(path.sep);
  const resolved = path.resolve(root, relative);

  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Recording object key resolves outside the configured storage root.");
  }

  return resolved;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
