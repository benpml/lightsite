import { describe, expect, it } from "vitest";
import {
  createTrackingSuppressionService,
  deriveSuppressionMarkerCandidates,
  hashTrackingSuppressionMarker,
  isTrackingSuppressionMarkerHashEqual,
  normalizeSuppressionMarkerValue,
  type TrackingInternalIpRangeMatch,
  type TrackingSuppressionMarkerRecord,
  type TrackingSuppressionMarkerUpsert,
  type TrackingSuppressionRepository,
} from "./suppression";

const hashSecret = "tracking-suppression-secret-at-least-32-characters";
const workspaceId = "workspace_1";
const now = new Date("2026-07-09T12:00:00.000Z");

class FakeSuppressionRepository implements TrackingSuppressionRepository {
  readonly markers = new Map<string, TrackingSuppressionMarkerRecord & {
    firstSeenAt: Date;
    lastSeenAt: Date;
  }>();

  internalIpRange: TrackingInternalIpRangeMatch | null = null;

  async upsertMarker(input: TrackingSuppressionMarkerUpsert) {
    const key = `${input.workspaceId}:${input.markerType}:${input.markerHash}`;
    const existing = this.markers.get(key);

    this.markers.set(key, {
      id: existing?.id ?? `marker_${this.markers.size + 1}`,
      workspaceId: input.workspaceId,
      userId: input.userId ?? existing?.userId ?? null,
      markerType: input.markerType,
      markerHash: input.markerHash,
      label: input.label ?? existing?.label ?? null,
      expiresAt: input.expiresAt ?? existing?.expiresAt ?? null,
      firstSeenAt: existing?.firstSeenAt ?? input.seenAt,
      lastSeenAt: input.seenAt,
    });
  }

  async findActiveMarkers(input: {
    workspaceId: string;
    markerHashes: string[];
    at: Date;
  }): Promise<TrackingSuppressionMarkerRecord[]> {
    const hashSet = new Set(input.markerHashes);

    return Array.from(this.markers.values()).filter(
      (marker) =>
        marker.workspaceId === input.workspaceId &&
        hashSet.has(marker.markerHash) &&
        (!marker.expiresAt || marker.expiresAt > input.at),
    );
  }

  async findMatchingInternalIpRange() {
    return this.internalIpRange;
  }
}

function createService(repository = new FakeSuppressionRepository()) {
  return {
    repository,
    service: createTrackingSuppressionService({
      repository,
      hashSecret,
      now: () => now,
    }),
  };
}

describe("tracking v2 suppression markers", () => {
  it("normalizes only the marker types that should be case-insensitive", () => {
    expect(normalizeSuppressionMarkerValue("email_domain", " Example.COM ")).toBe("example.com");
    expect(normalizeSuppressionMarkerValue("ip_address", " 2001:DB8::1 ")).toBe("2001:db8::1");
    expect(normalizeSuppressionMarkerValue("device_id", " Device_ABC ")).toBe("Device_ABC");
  });

  it("derives workspace-user markers without empty values", () => {
    expect(
      deriveSuppressionMarkerCandidates({
        userId: "user_1",
        email: "ben@Lightsite.com",
        ipAddress: "203.0.113.10",
        deviceId: "",
      }),
    ).toEqual([
      { markerType: "user_id", value: "user_1" },
      { markerType: "ip_address", value: "203.0.113.10" },
      { markerType: "email_domain", value: "lightsite.com" },
    ]);
  });

  it("hashes markers per workspace and marker type without leaking raw values", () => {
    const hash = hashTrackingSuppressionMarker({
      workspaceId,
      markerType: "device_id",
      value: "device_abc",
      secret: hashSecret,
    });
    const sameHash = hashTrackingSuppressionMarker({
      workspaceId,
      markerType: "device_id",
      value: "device_abc",
      secret: hashSecret,
    });
    const otherWorkspaceHash = hashTrackingSuppressionMarker({
      workspaceId: "workspace_2",
      markerType: "device_id",
      value: "device_abc",
      secret: hashSecret,
    });

    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("device_abc");
    expect(isTrackingSuppressionMarkerHashEqual(hash, sameHash)).toBe(true);
    expect(isTrackingSuppressionMarkerHashEqual(hash, otherWorkspaceHash)).toBe(false);
  });

  it("records deduped workspace-user markers", async () => {
    const { repository, service } = createService();

    await service.recordWorkspaceUserMarkers({
      workspaceId,
      userId: "user_1",
      email: "ben@lightsite.com",
      ipAddress: "203.0.113.10",
      deviceId: "device_abc",
    });
    await service.recordWorkspaceUserMarkers({
      workspaceId,
      userId: "user_1",
      email: "ben@lightsite.com",
      ipAddress: "203.0.113.10",
      deviceId: "device_abc",
      seenAt: new Date("2026-07-09T12:05:00.000Z"),
    });

    expect(repository.markers.size).toBe(4);
    expect(
      Array.from(repository.markers.values()).every((marker) =>
        marker.markerHash.length === 64 && !marker.markerHash.includes("203.0.113.10"),
      ),
    ).toBe(true);
  });

  it("suppresses recipient visits with a known device marker", async () => {
    const { service } = createService();

    await service.recordWorkspaceUserMarkers({
      workspaceId,
      userId: "user_1",
      email: "ben@lightsite.com",
      ipAddress: "203.0.113.10",
      deviceId: "device_abc",
    });

    await expect(
      service.evaluateRecipientVisit({
        workspaceId,
        deviceId: "device_abc",
        ipAddress: "198.51.100.20",
      }),
    ).resolves.toMatchObject({
      suppressed: true,
      reason: "suppression_marker",
      matchedMarkerTypes: ["device_id"],
    });
  });

  it("does not suppress solely because a historical workspace-user IP marker matches", async () => {
    const { service } = createService();

    await service.recordWorkspaceUserMarkers({
      workspaceId,
      userId: "user_1",
      email: null,
      ipAddress: "203.0.113.10",
      deviceId: null,
    });

    await expect(
      service.evaluateRecipientVisit({
        workspaceId,
        ipAddress: "203.0.113.10",
      }),
    ).resolves.toEqual({
      suppressed: false,
      reason: null,
      matchedMarkerTypes: ["ip_address"],
      internalIpRange: null,
    });
  });

  it("suppresses explicit internal IP ranges before marker checks", async () => {
    const { repository, service } = createService();
    repository.internalIpRange = {
      id: "range_1",
      workspaceId,
      label: "Office",
      ipRange: "203.0.113.0/24",
    };

    await expect(
      service.evaluateRecipientVisit({
        workspaceId,
        ipAddress: "203.0.113.10",
      }),
    ).resolves.toEqual({
      suppressed: true,
      reason: "internal_ip_range",
      matchedMarkerTypes: [],
      internalIpRange: repository.internalIpRange,
    });
  });

  it("ignores expired markers", async () => {
    const { service } = createService();

    await service.recordWorkspaceUserMarkers({
      workspaceId,
      userId: "user_1",
      email: null,
      ipAddress: null,
      deviceId: "device_abc",
      expiresAt: new Date("2026-07-09T11:59:00.000Z"),
    });

    await expect(
      service.evaluateRecipientVisit({
        workspaceId,
        deviceId: "device_abc",
      }),
    ).resolves.toEqual({
      suppressed: false,
      reason: null,
      matchedMarkerTypes: [],
      internalIpRange: null,
    });
  });
});
