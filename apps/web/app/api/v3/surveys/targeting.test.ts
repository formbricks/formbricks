import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TV3SurveyTargeting } from "./schemas";
import {
  areV3SurveyTargetingFiltersEqual,
  resolveV3ContactsEntitlement,
  setV3SurveySegmentFilters,
} from "./targeting";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    segment: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: vi.fn(),
}));

const EMPTY_FILTERS: TV3SurveyTargeting["filters"] = [];
type ResolvedOrganization = Awaited<ReturnType<typeof getOrganizationByWorkspaceId>>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveV3ContactsEntitlement", () => {
  test("uses the supplied organizationId without a workspace lookup", async () => {
    vi.mocked(getIsContactsEnabled).mockResolvedValueOnce(true);

    const result = await resolveV3ContactsEntitlement("ws_1", "org_1");

    expect(result).toEqual({ resolvedOrganizationId: "org_1", isContactsEnabled: true });
    expect(getOrganizationByWorkspaceId).not.toHaveBeenCalled();
    expect(getIsContactsEnabled).toHaveBeenCalledWith("org_1");
  });

  test("resolves the organization from the workspace when no id is supplied", async () => {
    vi.mocked(getOrganizationByWorkspaceId).mockResolvedValueOnce({
      id: "org_2",
    } as unknown as ResolvedOrganization);
    vi.mocked(getIsContactsEnabled).mockResolvedValueOnce(false);

    const result = await resolveV3ContactsEntitlement("ws_2");

    expect(getOrganizationByWorkspaceId).toHaveBeenCalledWith("ws_2");
    expect(getIsContactsEnabled).toHaveBeenCalledWith("org_2");
    expect(result).toEqual({ resolvedOrganizationId: "org_2", isContactsEnabled: false });
  });

  test("returns a null org and disabled flag when the workspace has no organization", async () => {
    vi.mocked(getOrganizationByWorkspaceId).mockResolvedValueOnce(null);

    const result = await resolveV3ContactsEntitlement("ws_3");

    expect(result).toEqual({ resolvedOrganizationId: null, isContactsEnabled: false });
    expect(getIsContactsEnabled).not.toHaveBeenCalled();
  });
});

describe("areV3SurveyTargetingFiltersEqual", () => {
  test("treats null/undefined and an empty array as equal", () => {
    expect(areV3SurveyTargetingFiltersEqual(null, [])).toBe(true);
    expect(areV3SurveyTargetingFiltersEqual(undefined, [])).toBe(true);
    expect(areV3SurveyTargetingFiltersEqual([], null)).toBe(true);
  });

  test("compares arrays positionally", () => {
    const filters = [{ id: "1", connector: null }];
    expect(areV3SurveyTargetingFiltersEqual(filters, [{ id: "1", connector: null }])).toBe(true);
    expect(
      areV3SurveyTargetingFiltersEqual(filters, [
        { id: "1", connector: null },
        { id: "2", connector: "and" },
      ])
    ).toBe(false);
    expect(areV3SurveyTargetingFiltersEqual(filters, [{ id: "2", connector: null }])).toBe(false);
  });

  test("compares object keys order-independently", () => {
    expect(areV3SurveyTargetingFiltersEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    // different key count
    expect(areV3SurveyTargetingFiltersEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    // same key count, different key name (exercises the Object.hasOwn guard)
    expect(areV3SurveyTargetingFiltersEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
  });

  test("recurses into nested filter structures", () => {
    const left = [{ resource: { root: { type: "attribute", contactAttributeKey: "email" } } }];
    const reordered = [{ resource: { root: { contactAttributeKey: "email", type: "attribute" } } }];
    const changed = [{ resource: { root: { type: "attribute", contactAttributeKey: "plan" } } }];

    expect(areV3SurveyTargetingFiltersEqual(left, reordered)).toBe(true);
    expect(areV3SurveyTargetingFiltersEqual(left, changed)).toBe(false);
  });

  test("handles primitives and type mismatches", () => {
    expect(areV3SurveyTargetingFiltersEqual("same", "same")).toBe(true);
    expect(areV3SurveyTargetingFiltersEqual(1, 2)).toBe(false);
    expect(areV3SurveyTargetingFiltersEqual({ a: 1 }, [1])).toBe(false);
    expect(areV3SurveyTargetingFiltersEqual([1], { a: 1 })).toBe(false);
  });
});

describe("setV3SurveySegmentFilters", () => {
  test("updates the segment via the default prisma client", async () => {
    await setV3SurveySegmentFilters("seg_1", EMPTY_FILTERS);

    expect(prisma.segment.update).toHaveBeenCalledWith({
      where: { id: "seg_1" },
      data: { filters: EMPTY_FILTERS },
    });
  });

  test("writes through a provided transaction client instead of the shared prisma client", async () => {
    const tx = { segment: { update: vi.fn() } };

    await setV3SurveySegmentFilters("seg_2", EMPTY_FILTERS, tx as unknown as Prisma.TransactionClient);

    expect(tx.segment.update).toHaveBeenCalledWith({
      where: { id: "seg_2" },
      data: { filters: EMPTY_FILTERS },
    });
    expect(prisma.segment.update).not.toHaveBeenCalled();
  });

  test("maps known Prisma errors to a DatabaseError", async () => {
    vi.mocked(prisma.segment.update).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("segment update failed", {
        code: "P2025",
        clientVersion: "test",
      })
    );

    await expect(setV3SurveySegmentFilters("seg_3", EMPTY_FILTERS)).rejects.toThrow(DatabaseError);
  });

  test("rethrows non-Prisma errors unchanged", async () => {
    const unexpected = new Error("connection lost");
    vi.mocked(prisma.segment.update).mockRejectedValueOnce(unexpected);

    await expect(setV3SurveySegmentFilters("seg_4", EMPTY_FILTERS)).rejects.toBe(unexpected);
  });
});
