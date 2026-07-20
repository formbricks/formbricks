import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { DatabaseError } from "@formbricks/types/errors";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { getSegments, getSurveyRefsForWorkspace } from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import type { TV3SurveyTargeting } from "./schemas";
import {
  areV3SurveyTargetingFiltersEqual,
  assertV3SurveyTargetingFilterReferences,
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

vi.mock("@/modules/ee/contacts/lib/contact-attribute-keys", () => ({
  getContactAttributeKeys: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  getSegments: vi.fn(),
  getSurveyRefsForWorkspace: vi.fn(),
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

type TFilterTree = TV3SurveyTargeting["filters"];

const leafNode = (id: string, root: Record<string, unknown>) => ({
  id,
  connector: null,
  resource: { id: `${id}_res`, root, qualifier: { operator: "equals" }, value: "x" },
});

const attributeFilterNode = (id: string, contactAttributeKey: string) =>
  leafNode(id, { type: "attribute", contactAttributeKey });
const personFilterNode = (id: string, personIdentifier: string) =>
  leafNode(id, { type: "person", personIdentifier });
const segmentFilterNode = (id: string, segmentId: string) => leafNode(id, { type: "segment", segmentId });
const deviceFilterNode = (id: string, value: unknown, deviceType: string = "phone") => ({
  id,
  connector: null,
  resource: {
    id: `${id}_res`,
    root: { type: "device", deviceType },
    qualifier: { operator: "equals" },
    value,
  },
});

const mockAttributeKeys = (keys: string[]): void => {
  vi.mocked(getContactAttributeKeys).mockResolvedValueOnce(
    keys.map((key) => ({ key })) as TContactAttributeKey[]
  );
};

const mockSegments = (ids: string[]): void => {
  vi.mocked(getSegments).mockResolvedValueOnce(
    ids.map((id) => ({ id })) as Awaited<ReturnType<typeof getSegments>>
  );
};

const surveyInteractionNode = (id: string, surveyScope: "any" | "specific", surveyIds: string[]) => ({
  id,
  connector: null,
  resource: {
    id: `${id}_res`,
    root: { type: "surveyInteraction" },
    qualifier: { operator: "haveSeen" },
    value: { surveyScope, surveyIds, within: { amount: 1, unit: "months" } },
  },
});

const mockSurveyRefs = (ids: string[]): void => {
  vi.mocked(getSurveyRefsForWorkspace).mockResolvedValueOnce(
    ids.map((id) => ({ id, name: id, status: "inProgress" })) as Awaited<
      ReturnType<typeof getSurveyRefsForWorkspace>
    >
  );
};

describe("assertV3SurveyTargetingFilterReferences", () => {
  test("performs no workspace lookup when filters need none", async () => {
    const validDeviceOnly = [deviceFilterNode("f1", "phone")] as unknown as TFilterTree;

    await expect(assertV3SurveyTargetingFilterReferences("ws_1", EMPTY_FILTERS)).resolves.toBeUndefined();
    await expect(assertV3SurveyTargetingFilterReferences("ws_1", validDeviceOnly)).resolves.toBeUndefined();
    expect(getContactAttributeKeys).not.toHaveBeenCalled();
    expect(getSegments).not.toHaveBeenCalled();
  });

  test("rejects a device filter whose value is not a known device, without any lookup", async () => {
    const filters = [deviceFilterNode("f1", "tablet")] as unknown as TFilterTree;

    await expect(assertV3SurveyTargetingFilterReferences("ws_1", filters)).rejects.toMatchObject({
      invalidParams: [
        {
          name: "targeting.filters.0.resource.value",
          reason: "Unsupported device 'tablet'; expected one of: phone, desktop",
          code: "invalid_reference",
          identifier: "tablet",
        },
      ],
    });
    expect(getContactAttributeKeys).not.toHaveBeenCalled();
    expect(getSegments).not.toHaveBeenCalled();
  });

  test("rejects a garbage root.deviceType even when value is a known device", async () => {
    const filters = [deviceFilterNode("f1", "phone", "tablet")] as unknown as TFilterTree;

    await expect(assertV3SurveyTargetingFilterReferences("ws_1", filters)).rejects.toMatchObject({
      invalidParams: [
        {
          name: "targeting.filters.0.resource.root.deviceType",
          reason: "Unsupported device 'tablet'; expected one of: phone, desktop",
          code: "invalid_reference",
          identifier: "tablet",
        },
      ],
    });
  });

  test("resolves when every referenced attribute key exists in the workspace", async () => {
    mockAttributeKeys(["plan", "role"]);
    const filters = [
      attributeFilterNode("f1", "plan"),
      attributeFilterNode("f2", "role"),
    ] as unknown as TFilterTree;

    await expect(assertV3SurveyTargetingFilterReferences("ws_1", filters)).resolves.toBeUndefined();
    expect(getContactAttributeKeys).toHaveBeenCalledWith("ws_1");
  });

  test("throws invalid_reference with the filter path for an unknown attribute key", async () => {
    mockAttributeKeys(["plan"]);
    const filters = [attributeFilterNode("f1", "made_up_key")] as unknown as TFilterTree;

    try {
      await assertV3SurveyTargetingFilterReferences("ws_1", filters);
      throw new Error("expected assertion to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(V3SurveyReferenceValidationError);
      expect((error as V3SurveyReferenceValidationError).invalidParams).toEqual([
        {
          name: "targeting.filters.0.resource.root.contactAttributeKey",
          reason: "Contact attribute key 'made_up_key' was not found in this workspace",
          code: "invalid_reference",
          identifier: "made_up_key",
        },
      ]);
    }
  });

  test("recurses into nested filter groups and reports the nested path", async () => {
    mockAttributeKeys(["plan"]);
    const filters = [
      {
        id: "group1",
        connector: null,
        resource: [attributeFilterNode("f1", "unknown_nested")],
      },
    ] as unknown as TFilterTree;

    await expect(assertV3SurveyTargetingFilterReferences("ws_1", filters)).rejects.toMatchObject({
      invalidParams: [
        {
          name: "targeting.filters.0.resource.0.resource.root.contactAttributeKey",
          identifier: "unknown_nested",
          code: "invalid_reference",
        },
      ],
    });
  });

  test("validates a person 'userId' filter against the userId attribute key", async () => {
    mockAttributeKeys(["userId"]);
    const ok = [personFilterNode("f1", "userId")] as unknown as TFilterTree;
    await expect(assertV3SurveyTargetingFilterReferences("ws_1", ok)).resolves.toBeUndefined();

    mockAttributeKeys([]);
    const missing = [personFilterNode("f1", "userId")] as unknown as TFilterTree;
    await expect(assertV3SurveyTargetingFilterReferences("ws_1", missing)).rejects.toMatchObject({
      invalidParams: [
        {
          name: "targeting.filters.0.resource.root.personIdentifier",
          identifier: "userId",
          code: "invalid_reference",
        },
      ],
    });
  });

  test("rejects an unsupported person identifier without any lookup", async () => {
    const filters = [personFilterNode("f1", "email")] as unknown as TFilterTree;

    await expect(assertV3SurveyTargetingFilterReferences("ws_1", filters)).rejects.toMatchObject({
      invalidParams: [
        {
          name: "targeting.filters.0.resource.root.personIdentifier",
          reason: "Unsupported person identifier 'email'; only 'userId' is supported",
          code: "invalid_reference",
          identifier: "email",
        },
      ],
    });
    expect(getContactAttributeKeys).not.toHaveBeenCalled();
    expect(getSegments).not.toHaveBeenCalled();
  });

  test("resolves a segment filter that references a workspace segment", async () => {
    mockSegments(["seg_known"]);
    const filters = [segmentFilterNode("f1", "seg_known")] as unknown as TFilterTree;

    await expect(assertV3SurveyTargetingFilterReferences("ws_1", filters)).resolves.toBeUndefined();
    expect(getSegments).toHaveBeenCalledWith("ws_1");
  });

  test("rejects a segment filter referencing an unknown or foreign segment", async () => {
    mockSegments(["seg_known"]);
    const filters = [segmentFilterNode("f1", "seg_other_workspace")] as unknown as TFilterTree;

    await expect(assertV3SurveyTargetingFilterReferences("ws_1", filters)).rejects.toMatchObject({
      invalidParams: [
        {
          name: "targeting.filters.0.resource.root.segmentId",
          reason: "Segment 'seg_other_workspace' was not found in this workspace",
          code: "invalid_reference",
          identifier: "seg_other_workspace",
        },
      ],
    });
  });

  test("skips the survey lookup for an any-scope survey interaction filter", async () => {
    const filters = [surveyInteractionNode("f1", "any", [])] as unknown as TFilterTree;

    await expect(assertV3SurveyTargetingFilterReferences("ws_1", filters)).resolves.toBeUndefined();
    expect(getSurveyRefsForWorkspace).not.toHaveBeenCalled();
  });

  test("resolves a specific-scope survey interaction filter against workspace surveys", async () => {
    mockSurveyRefs(["survey_known"]);
    const filters = [surveyInteractionNode("f1", "specific", ["survey_known"])] as unknown as TFilterTree;

    await expect(assertV3SurveyTargetingFilterReferences("ws_1", filters)).resolves.toBeUndefined();
    expect(getSurveyRefsForWorkspace).toHaveBeenCalledWith("ws_1");
  });

  test("rejects a survey interaction filter referencing an unknown or foreign survey", async () => {
    mockSurveyRefs(["survey_known"]);
    const filters = [
      surveyInteractionNode("f1", "specific", ["survey_known", "survey_foreign"]),
    ] as unknown as TFilterTree;

    await expect(assertV3SurveyTargetingFilterReferences("ws_1", filters)).rejects.toMatchObject({
      invalidParams: [
        {
          name: "targeting.filters.0.resource.value.surveyIds.1",
          reason: "Survey 'survey_foreign' was not found in this workspace",
          code: "invalid_reference",
          identifier: "survey_foreign",
        },
      ],
    });
  });
});
