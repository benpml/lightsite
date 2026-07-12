import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import {
  trackingInternalIpRanges,
  trackingSuppressionMarkers,
} from "@lightsite/db/schema";
import type { Database } from "@lightsite/db";
import type { TrackingV2SuppressionMarkerType } from "@lightsite/tracking-schema";

export type TrackingSuppressionMarkerCandidate = {
  markerType: TrackingV2SuppressionMarkerType;
  value: string;
};

export type TrackingSuppressionMarkerHashInput = TrackingSuppressionMarkerCandidate & {
  workspaceId: string;
};

export type TrackingSuppressionMarkerUpsert = {
  workspaceId: string;
  userId: string | null;
  markerType: TrackingV2SuppressionMarkerType;
  markerHash: string;
  label: string | null;
  seenAt: Date;
  expiresAt: Date | null;
};

export type TrackingSuppressionMarkerRecord = {
  id: string;
  workspaceId: string;
  userId: string | null;
  markerType: TrackingV2SuppressionMarkerType;
  markerHash: string;
  label: string | null;
  expiresAt: Date | null;
};

export type TrackingInternalIpRangeMatch = {
  id: string;
  workspaceId: string;
  label: string;
  ipRange: string;
};

export interface TrackingSuppressionRepository {
  upsertMarker(input: TrackingSuppressionMarkerUpsert): Promise<void>;
  findActiveMarkers(input: {
    workspaceId: string;
    markerHashes: string[];
    at: Date;
  }): Promise<TrackingSuppressionMarkerRecord[]>;
  findMatchingInternalIpRange(input: {
    workspaceId: string;
    ipAddress: string;
  }): Promise<TrackingInternalIpRangeMatch | null>;
}

export type TrackingSuppressionServiceOptions = {
  repository: TrackingSuppressionRepository;
  hashSecret: string;
  now?: () => Date;
  allowIpMarkerSuppression?: boolean;
};

export type RecordWorkspaceUserTrackingMarkersInput = {
  workspaceId: string;
  userId: string;
  email: string | null;
  ipAddress: string | null;
  deviceId: string | null;
  seenAt?: Date;
  expiresAt?: Date | null;
};

export type TrackingSuppressionDecisionInput = {
  workspaceId: string;
  userId?: string | null;
  email?: string | null;
  ipAddress?: string | null;
  deviceId?: string | null;
  at?: Date;
};

export type TrackingSuppressionDecision = {
  suppressed: boolean;
  reason: "internal_ip_range" | "suppression_marker" | null;
  matchedMarkerTypes: TrackingV2SuppressionMarkerType[];
  internalIpRange: TrackingInternalIpRangeMatch | null;
};

export interface TrackingSuppressionService {
  recordWorkspaceUserMarkers(input: RecordWorkspaceUserTrackingMarkersInput): Promise<{
    markerCount: number;
  }>;
  evaluateRecipientVisit(input: TrackingSuppressionDecisionInput): Promise<TrackingSuppressionDecision>;
}

const SUPPRESSING_MARKER_TYPES = new Set<TrackingV2SuppressionMarkerType>([
  "device_id",
  "user_id",
  "email_domain",
]);

export function createDbTrackingSuppressionRepository(
  database: Database,
): TrackingSuppressionRepository {
  return {
    async upsertMarker(input) {
      await database
        .insert(trackingSuppressionMarkers)
        .values({
          workspaceId: input.workspaceId,
          userId: input.userId,
          markerType: input.markerType,
          markerHash: input.markerHash,
          label: input.label,
          firstSeenAt: input.seenAt,
          lastSeenAt: input.seenAt,
          expiresAt: input.expiresAt,
          updatedAt: input.seenAt,
        })
        .onConflictDoUpdate({
          target: [
            trackingSuppressionMarkers.workspaceId,
            trackingSuppressionMarkers.markerType,
            trackingSuppressionMarkers.markerHash,
          ],
          set: {
            userId: sql`coalesce(excluded.user_id, ${trackingSuppressionMarkers.userId})`,
            label: sql`coalesce(excluded.label, ${trackingSuppressionMarkers.label})`,
            lastSeenAt: input.seenAt,
            expiresAt: sql`coalesce(excluded.expires_at, ${trackingSuppressionMarkers.expiresAt})`,
            updatedAt: input.seenAt,
          },
        });
    },

    async findActiveMarkers(input) {
      if (input.markerHashes.length === 0) {
        return [];
      }

      const rows = await database
        .select({
          id: trackingSuppressionMarkers.id,
          workspaceId: trackingSuppressionMarkers.workspaceId,
          userId: trackingSuppressionMarkers.userId,
          markerType: trackingSuppressionMarkers.markerType,
          markerHash: trackingSuppressionMarkers.markerHash,
          label: trackingSuppressionMarkers.label,
          expiresAt: trackingSuppressionMarkers.expiresAt,
        })
        .from(trackingSuppressionMarkers)
        .where(
          and(
            eq(trackingSuppressionMarkers.workspaceId, input.workspaceId),
            inArray(trackingSuppressionMarkers.markerHash, input.markerHashes),
            or(
              isNull(trackingSuppressionMarkers.expiresAt),
              gt(trackingSuppressionMarkers.expiresAt, input.at),
            ),
          ),
        );

      return rows;
    },

    async findMatchingInternalIpRange(input) {
      const [row] = await database
        .select({
          id: trackingInternalIpRanges.id,
          workspaceId: trackingInternalIpRanges.workspaceId,
          label: trackingInternalIpRanges.label,
          ipRange: trackingInternalIpRanges.ipRange,
        })
        .from(trackingInternalIpRanges)
        .where(
          and(
            eq(trackingInternalIpRanges.workspaceId, input.workspaceId),
            eq(trackingInternalIpRanges.enabled, true),
            sql`${input.ipAddress}::inet <<= ${trackingInternalIpRanges.ipRange}`,
          ),
        )
        .limit(1);

      return row ?? null;
    },
  };
}

export function createTrackingSuppressionService(
  options: TrackingSuppressionServiceOptions,
): TrackingSuppressionService {
  assertHashSecret(options.hashSecret);

  const now = options.now ?? (() => new Date());
  const allowIpMarkerSuppression = options.allowIpMarkerSuppression ?? false;

  return {
    async recordWorkspaceUserMarkers(input) {
      const seenAt = input.seenAt ?? now();
      const markers = deriveSuppressionMarkerCandidates(input);

      await Promise.all(
        markers.map((marker) =>
          options.repository.upsertMarker({
            workspaceId: input.workspaceId,
            userId: input.userId,
            markerType: marker.markerType,
            markerHash: hashTrackingSuppressionMarker({
              workspaceId: input.workspaceId,
              markerType: marker.markerType,
              value: marker.value,
              secret: options.hashSecret,
            }),
            label: getMarkerLabel(marker),
            seenAt,
            expiresAt: input.expiresAt ?? null,
          }),
        ),
      );

      return { markerCount: markers.length };
    },

    async evaluateRecipientVisit(input) {
      const at = input.at ?? now();
      const internalIpRange = input.ipAddress
        ? await options.repository.findMatchingInternalIpRange({
            workspaceId: input.workspaceId,
            ipAddress: input.ipAddress,
          })
        : null;

      if (internalIpRange) {
        return {
          suppressed: true,
          reason: "internal_ip_range",
          matchedMarkerTypes: [],
          internalIpRange,
        };
      }

      const markerCandidates = deriveSuppressionMarkerCandidates({
        userId: input.userId ?? null,
        email: input.email ?? null,
        ipAddress: input.ipAddress ?? null,
        deviceId: input.deviceId ?? null,
      });
      const markerHashes = markerCandidates.map((marker) =>
        hashTrackingSuppressionMarker({
          workspaceId: input.workspaceId,
          markerType: marker.markerType,
          value: marker.value,
          secret: options.hashSecret,
        }),
      );
      const activeMarkers = await options.repository.findActiveMarkers({
        workspaceId: input.workspaceId,
        markerHashes,
        at,
      });
      const matchedMarkerTypes = dedupeMarkerTypes(activeMarkers.map((marker) => marker.markerType));
      const suppressingMarker = activeMarkers.find((marker) =>
        marker.markerType === "ip_address"
          ? allowIpMarkerSuppression
          : SUPPRESSING_MARKER_TYPES.has(marker.markerType),
      );

      return {
        suppressed: Boolean(suppressingMarker),
        reason: suppressingMarker ? "suppression_marker" : null,
        matchedMarkerTypes,
        internalIpRange: null,
      };
    },
  };
}

export function deriveSuppressionMarkerCandidates(input: {
  userId?: string | null;
  email?: string | null;
  ipAddress?: string | null;
  deviceId?: string | null;
}): TrackingSuppressionMarkerCandidate[] {
  const candidates: TrackingSuppressionMarkerCandidate[] = [];

  addCandidate(candidates, "device_id", input.deviceId);
  addCandidate(candidates, "user_id", input.userId);
  addCandidate(candidates, "ip_address", input.ipAddress);

  const emailDomain = extractEmailDomain(input.email);
  if (emailDomain) {
    candidates.push({
      markerType: "email_domain",
      value: emailDomain,
    });
  }

  return candidates;
}

export function hashTrackingSuppressionMarker(input: TrackingSuppressionMarkerHashInput & {
  secret: string;
}): string {
  assertHashSecret(input.secret);
  const normalizedValue = normalizeSuppressionMarkerValue(input.markerType, input.value);
  const payload = [
    "tracking-suppression",
    input.workspaceId,
    input.markerType,
    normalizedValue,
  ].join(":");

  return createHmac("sha256", input.secret).update(payload).digest("hex");
}

export function isTrackingSuppressionMarkerHashEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function normalizeSuppressionMarkerValue(
  markerType: TrackingV2SuppressionMarkerType,
  value: string,
): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  switch (markerType) {
    case "email_domain":
      return trimmed.toLowerCase();
    case "ip_address":
      return trimmed.toLowerCase();
    case "device_id":
      return trimmed;
    case "user_id":
      return trimmed;
  }
}

function addCandidate(
  candidates: TrackingSuppressionMarkerCandidate[],
  markerType: TrackingV2SuppressionMarkerType,
  value: string | null | undefined,
) {
  const normalizedValue = value ? normalizeSuppressionMarkerValue(markerType, value) : "";

  if (!normalizedValue) {
    return;
  }

  candidates.push({
    markerType,
    value: normalizedValue,
  });
}

function extractEmailDomain(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return null;
  }

  return trimmed.slice(atIndex + 1);
}

function getMarkerLabel(marker: TrackingSuppressionMarkerCandidate): string | null {
  switch (marker.markerType) {
    case "device_id":
      return "Workspace user device";
    case "user_id":
      return "Workspace user account";
    case "ip_address":
      return "Workspace user IP";
    case "email_domain":
      return "Workspace email domain";
  }
}

function dedupeMarkerTypes(
  markerTypes: TrackingV2SuppressionMarkerType[],
): TrackingV2SuppressionMarkerType[] {
  return Array.from(new Set(markerTypes));
}

function assertHashSecret(secret: string) {
  if (secret.length < 32) {
    throw new Error("Tracking suppression hash secret must be at least 32 characters.");
  }
}
