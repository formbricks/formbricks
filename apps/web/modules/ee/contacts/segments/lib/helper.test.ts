import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  MAX_SEGMENT_SURVEY_INTERACTION_IDS_PER_TREE,
  TBaseFilters,
  TSegmentWithSurveyRefs,
} from "@formbricks/types/segment";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import {
  SEGMENT_FILTERS_READ_HIDDEN_SURVEY_MESSAGE,
  assertSegmentSurveyFiltersVisible,
  assertSurveyInteractionSurveyIds,
  assertSurveysInWorkspace,
  checkForRecursiveSegmentFilter,
  collectSurveyIdsFromSegmentFilters,
  getSurveyIdsReadBySegments,
  segmentFiltersReadHiddenSurvey,
} from "@/modules/ee/contacts/segments/lib/helper";
import { getSegment } from "@/modules/ee/contacts/segments/lib/segments";

const mockSurveyFindMany = vi.fn();
const mockSurveyFindFirst = vi.fn();

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findMany: (...args: unknown[]) => mockSurveyFindMany(...args),
      findFirst: (...args: unknown[]) => mockSurveyFindFirst(...args),
    },
  },
}));

// Mock dependencies
vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  getSegment: vi.fn(),
}));

describe("checkForRecursiveSegmentFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should throw InvalidInputError when a filter references the same segment ID as the one being checked", async () => {
    // Arrange
    const segmentId = "segment-123";

    // Create a filter that references the same segment ID
    const filters = [
      {
        operator: "and",
        resource: {
          root: {
            type: "segment",
            segmentId, // This creates the recursive reference
          },
        },
      },
    ];

    // Act & Assert
    await expect(
      checkForRecursiveSegmentFilter(filters as unknown as TBaseFilters, segmentId)
    ).rejects.toThrow(new InvalidInputError("Recursive segment filter is not allowed"));

    // Verify that getSegment was not called since the function should throw before reaching that point
    expect(getSegment).not.toHaveBeenCalled();
  });

  test("should complete successfully when filters do not reference the same segment ID as the one being checked", async () => {
    // Arrange
    const segmentId = "segment-123";
    const differentSegmentId = "segment-456";

    // Create a filter that references a different segment ID
    const filters = [
      {
        operator: "and",
        resource: {
          root: {
            type: "segment",
            segmentId: differentSegmentId, // Different segment ID
          },
        },
      },
    ];

    // Mock the referenced segment to have non-recursive filters
    const referencedSegment = {
      id: differentSegmentId,
      filters: [
        {
          operator: "and",
          resource: {
            root: {
              type: "attribute",
              attributeClassName: "user",
              attributeKey: "email",
            },
            operator: "equals",
            value: "test@example.com",
          },
        },
      ],
    };

    vi.mocked(getSegment).mockResolvedValue(referencedSegment as unknown as TSegmentWithSurveyRefs);

    // Act & Assert
    // The function should complete without throwing an error
    await expect(
      checkForRecursiveSegmentFilter(filters as unknown as TBaseFilters, segmentId)
    ).resolves.toBeUndefined();

    // Verify that getSegment was called with the correct segment ID
    expect(getSegment).toHaveBeenCalledWith(differentSegmentId);
    expect(getSegment).toHaveBeenCalledTimes(1);
  });

  test("should recursively check nested filters for recursive references and throw InvalidInputError", async () => {
    // Arrange
    const originalSegmentId = "segment-123";
    const nestedSegmentId = "segment-456";

    // Create a filter that references another segment
    const filters = [
      {
        operator: "and",
        resource: {
          root: {
            type: "segment",
            segmentId: nestedSegmentId, // This references another segment
          },
        },
      },
    ];

    // Mock the nested segment to have a filter that references back to the original segment
    // This creates an indirect recursive reference
    vi.mocked(getSegment).mockResolvedValueOnce({
      id: nestedSegmentId,
      filters: [
        {
          operator: "and",
          resource: [
            {
              id: "group-1",
              connector: null,
              resource: {
                root: {
                  type: "segment",
                  segmentId: originalSegmentId, // This creates the recursive reference back to the original segment
                },
              },
            },
          ],
        },
      ],
    } as any);

    // Act & Assert
    await expect(
      checkForRecursiveSegmentFilter(filters as unknown as TBaseFilters, originalSegmentId)
    ).rejects.toThrow(new InvalidInputError("Recursive segment filter is not allowed"));

    // Verify that getSegment was called with the nested segment ID
    expect(getSegment).toHaveBeenCalledWith(nestedSegmentId);

    // Verify that getSegment was called exactly once
    expect(getSegment).toHaveBeenCalledTimes(1);
  });

  test("should detect circular references between multiple segments", async () => {
    // Arrange
    const segmentIdA = "segment-A";
    const segmentIdB = "segment-B";
    const segmentIdC = "segment-C";

    // Create filters for segment A that reference segment B
    const filtersA = [
      {
        operator: "and",
        resource: {
          root: {
            type: "segment",
            segmentId: segmentIdB, // A references B
          },
        },
      },
    ];

    // Create filters for segment B that reference segment C
    const filtersB = [
      {
        operator: "and",
        resource: {
          root: {
            type: "segment",
            segmentId: segmentIdC, // B references C
          },
        },
      },
    ];

    // Create filters for segment C that reference segment A (creating a circular reference)
    const filtersC = [
      {
        operator: "and",
        resource: {
          root: {
            type: "segment",
            segmentId: segmentIdA, // C references back to A, creating a circular reference
          },
        },
      },
    ];

    // Mock getSegment to return appropriate segment data for each segment ID
    vi.mocked(getSegment).mockImplementation(async (id) => {
      if (id === segmentIdB) {
        return { id: segmentIdB, filters: filtersB } as any;
      } else if (id === segmentIdC) {
        return { id: segmentIdC, filters: filtersC } as any;
      }
      return { id, filters: [] } as any;
    });

    // Act & Assert
    await expect(
      checkForRecursiveSegmentFilter(filtersA as unknown as TBaseFilters, segmentIdA)
    ).rejects.toThrow(new InvalidInputError("Recursive segment filter is not allowed"));

    // Verify that getSegment was called for segments B and C
    expect(getSegment).toHaveBeenCalledWith(segmentIdB);
    expect(getSegment).toHaveBeenCalledWith(segmentIdC);

    // Verify the number of calls to getSegment (should be 2)
    expect(getSegment).toHaveBeenCalledTimes(2);
  });
});

describe("collectSurveyIdsFromSegmentFilters", () => {
  test("collects ids from specific-scope survey interaction filters, including nested groups", () => {
    const filters = [
      {
        id: "f1",
        connector: null,
        resource: {
          id: "si1",
          root: { type: "surveyInteraction" },
          qualifier: { operator: "haveSeen" },
          value: { surveyScope: "specific", surveyIds: ["s1", "s2"], within: { amount: 1, unit: "months" } },
        },
      },
      {
        id: "group1",
        connector: "and",
        resource: [
          {
            id: "f2",
            connector: null,
            resource: {
              id: "si2",
              root: { type: "surveyInteraction" },
              qualifier: { operator: "haveCompleted" },
              value: { surveyScope: "specific", surveyIds: ["s3"], within: { amount: 1, unit: "months" } },
            },
          },
        ],
      },
    ];

    expect(collectSurveyIdsFromSegmentFilters(filters as unknown as TBaseFilters)).toEqual([
      "s1",
      "s2",
      "s3",
    ]);
  });

  test("ignores any-scope survey interaction filters and other filter types", () => {
    const filters = [
      {
        id: "f1",
        connector: null,
        resource: {
          id: "si1",
          root: { type: "surveyInteraction" },
          qualifier: { operator: "haveSeen" },
          value: { surveyScope: "any", surveyIds: [], within: { amount: 1, unit: "months" } },
        },
      },
      {
        id: "f2",
        connector: "and",
        resource: {
          id: "attr1",
          root: { type: "attribute", contactAttributeKey: "email" },
          qualifier: { operator: "equals" },
          value: "a@b.com",
        },
      },
    ];

    expect(collectSurveyIdsFromSegmentFilters(filters as unknown as TBaseFilters)).toEqual([]);
  });
});

describe("assertSurveyInteractionSurveyIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const buildSpecificFilter = (surveyIds: string[]): TBaseFilters =>
    [
      {
        id: "f1",
        connector: null,
        resource: {
          id: "si1",
          root: { type: "surveyInteraction" },
          qualifier: { operator: "haveSeen" },
          value: { surveyScope: "specific", surveyIds, within: { amount: 1, unit: "months" } },
        },
      },
    ] as unknown as TBaseFilters;

  test("skips the DB lookup when there are no specific survey ids", async () => {
    await assertSurveyInteractionSurveyIds(buildSpecificFilter([]), "workspace-1");
    expect(mockSurveyFindMany).not.toHaveBeenCalled();
  });

  test("passes when every referenced survey belongs to the workspace", async () => {
    mockSurveyFindMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);

    await expect(
      assertSurveyInteractionSurveyIds(buildSpecificFilter(["s1", "s2"]), "workspace-1")
    ).resolves.toBeUndefined();

    expect(mockSurveyFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1", "s2"] }, workspaceId: "workspace-1" },
      select: { id: true },
    });
  });

  test("throws when a referenced survey is missing from the workspace", async () => {
    mockSurveyFindMany.mockResolvedValue([{ id: "s1" }]);

    await expect(
      assertSurveyInteractionSurveyIds(buildSpecificFilter(["s1", "s2"]), "workspace-1")
    ).rejects.toThrow(new InvalidInputError("Survey not found in workspace: s2"));
  });

  test("deduplicates ids collected across filters before querying", async () => {
    const filters = [
      ...buildSpecificFilter(["s1", "s2"]),
      ...buildSpecificFilter(["s2", "s1"]),
    ] as unknown as TBaseFilters;
    mockSurveyFindMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);

    await expect(assertSurveyInteractionSurveyIds(filters, "workspace-1")).resolves.toBeUndefined();

    expect(mockSurveyFindMany).toHaveBeenCalledTimes(1);
    expect(mockSurveyFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1", "s2"] }, workspaceId: "workspace-1" },
      select: { id: true },
    });
  });

  test("splits an oversized id list into bounded sequential batches, all workspace-scoped", async () => {
    const surveyIds = Array.from({ length: 450 }, (_, index) => `s_${index}`);
    mockSurveyFindMany.mockImplementation(async ({ where }: any) =>
      where.id.in.map((id: string) => ({ id }))
    );

    await expect(
      assertSurveyInteractionSurveyIds(buildSpecificFilter(surveyIds), "workspace-1")
    ).resolves.toBeUndefined();

    // 450 ids at a batch size of 200 -> 200 / 200 / 50, each query scoped to the workspace.
    const batchSizes = mockSurveyFindMany.mock.calls.map(([args]: any) => args.where.id.in.length);
    expect(batchSizes).toEqual([200, 200, 50]);
    for (const [args] of mockSurveyFindMany.mock.calls) {
      expect((args as any).where.workspaceId).toBe("workspace-1");
    }
  });

  test("throws on the first missing id in collection order and stops querying further batches", async () => {
    const surveyIds = Array.from({ length: 450 }, (_, index) => `s_${index}`);
    // Two ids in the second batch are foreign/unknown; the earlier one must win, and the third
    // batch must never be queried.
    mockSurveyFindMany.mockImplementation(async ({ where }: any) =>
      where.id.in.filter((id: string) => id !== "s_205" && id !== "s_210").map((id: string) => ({ id }))
    );

    await expect(
      assertSurveyInteractionSurveyIds(buildSpecificFilter(surveyIds), "workspace-1")
    ).rejects.toThrow(new InvalidInputError("Survey not found in workspace: s_205"));

    expect(mockSurveyFindMany).toHaveBeenCalledTimes(2);
  });

  test("a parsed-tree-max payload (the tree-wide id cap) resolves in exactly five batches", async () => {
    // Callers pass ZSegmentFilters-parsed trees, so the largest total this guard can receive is
    // MAX_SEGMENT_SURVEY_INTERACTION_IDS_PER_TREE ids — pin that worst case: ceil(1000/200) = 5
    // sequential batches, no more.
    const filterCount = MAX_SEGMENT_SURVEY_INTERACTION_IDS_PER_TREE / 100;
    const filters = Array.from({ length: filterCount }, (_, filterIndex) => ({
      id: `f_${filterIndex}`,
      connector: filterIndex === 0 ? null : "and",
      resource: {
        id: `si_${filterIndex}`,
        root: { type: "surveyInteraction" },
        qualifier: { operator: "haveSeen" },
        value: {
          surveyScope: "specific",
          surveyIds: Array.from({ length: 100 }, (_, idIndex) => `s_${filterIndex * 100 + idIndex}`),
          within: { amount: 1, unit: "months" },
        },
      },
    })) as unknown as TBaseFilters;
    mockSurveyFindMany.mockImplementation(async ({ where }: any) =>
      where.id.in.map((id: string) => ({ id }))
    );

    await expect(assertSurveyInteractionSurveyIds(filters, "workspace-1")).resolves.toBeUndefined();

    const batchSizes = mockSurveyFindMany.mock.calls.map(([args]: any) => args.where.id.in.length);
    expect(batchSizes).toEqual([200, 200, 200, 200, 200]);
  });
});

describe("assertSurveysInWorkspace (ENG-3282)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const visibleWhere = { OR: [{ visibility: "workspace" as const }, { ownerId: "user-1" }] };

  test("scopes the lookup to the caller's visibility and rejects a survey it does not admit", async () => {
    mockSurveyFindMany.mockResolvedValue([{ id: "s1" }]);

    await expect(assertSurveysInWorkspace(["s1", "s2", "s1"], "workspace-1", visibleWhere)).rejects.toThrow(
      new InvalidInputError("Survey not found in workspace: s2")
    );
    expect(mockSurveyFindMany).toHaveBeenCalledOnce();
    expect(mockSurveyFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1", "s2"] }, workspaceId: "workspace-1", AND: [visibleWhere] },
      select: { id: true },
    });
  });

  test("passes when the caller's visibility admits every survey", async () => {
    mockSurveyFindMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);

    await expect(
      assertSurveysInWorkspace(["s1", "s2"], "workspace-1", visibleWhere)
    ).resolves.toBeUndefined();
  });
});

describe("segmentFiltersReadHiddenSurvey (ENG-6870)", () => {
  const workspaceId = "ws1";
  const restrictedId = "clrestricted00000000000001";
  const visibleId = "clvisible000000000000000001";
  const member: TSurveyActorContext = {
    enforced: true,
    isOrganizationAdmin: false,
    kind: "user",
    userId: "u1",
  };
  const owner: TSurveyActorContext = {
    enforced: true,
    isOrganizationAdmin: true,
    kind: "user",
    userId: "u0",
  };
  const apiKey: TSurveyActorContext = { enforced: true, kind: "apiKey" };

  const interaction = (surveyScope: "any" | "specific", surveyIds: string[] = []) => ({
    id: `f-${surveyScope}-${surveyIds.join("-")}`,
    connector: null,
    resource: {
      id: "r1",
      root: { type: "surveyInteraction" },
      qualifier: { operator: "haveCompleted" },
      value: { surveyScope, surveyIds, within: { amount: 30, unit: "days" } },
    },
  });
  const nestedSegment = (segmentId: string) => ({
    id: `f-seg-${segmentId}`,
    connector: "and",
    resource: {
      id: "r2",
      root: { type: "segment", segmentId },
      qualifier: { operator: "userIsIn" },
      value: segmentId,
    },
  });
  const tree = (...filters: unknown[]) => filters as TBaseFilters;
  const segment = (id: string, filters: TBaseFilters, ws = workspaceId) =>
    ({ id, filters, workspaceId: ws }) as unknown as TSegmentWithSurveyRefs;
  const memberHiddenWhere = {
    AND: [
      expect.objectContaining({ OR: expect.arrayContaining([{ visibility: "restricted" }]) }),
      { OR: [{ ownerId: null }, { ownerId: { not: "u1" } }] },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSurveyFindFirst.mockResolvedValue(null);
  });

  test("an organization owner or manager sees every survey: nothing to look up", async () => {
    const result = await segmentFiltersReadHiddenSurvey(
      tree(interaction("specific", [restrictedId]), nestedSegment("clnested000000000000000001")),
      workspaceId,
      owner
    );

    expect(result).toBe(false);
    expect(mockSurveyFindFirst).not.toHaveBeenCalled();
    expect(getSegment).not.toHaveBeenCalled();
  });

  test("a specific filter on a survey hidden from a member reads a hidden survey", async () => {
    mockSurveyFindFirst.mockResolvedValue({ id: restrictedId });

    const result = await segmentFiltersReadHiddenSurvey(
      tree(interaction("specific", [visibleId, restrictedId])),
      workspaceId,
      member
    );

    expect(result).toBe(true);
    expect(mockSurveyFindFirst).toHaveBeenCalledWith({
      where: { id: { in: [visibleId, restrictedId] }, workspaceId, AND: [memberHiddenWhere] },
      select: { id: true },
    });
  });

  test("an API key is held to the restricted-survey clause", async () => {
    mockSurveyFindFirst.mockResolvedValue({ id: restrictedId });

    expect(
      await segmentFiltersReadHiddenSurvey(tree(interaction("specific", [restrictedId])), workspaceId, apiKey)
    ).toBe(true);
    expect(mockSurveyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [expect.objectContaining({ OR: expect.arrayContaining([{ visibility: "restricted" }]) })],
        }),
      })
    );
  });

  // `any` only reads workspace-visible surveys, so it never needs the caller to see more.
  test("`any` scope names no survey and costs no query", async () => {
    expect(await segmentFiltersReadHiddenSurvey(tree(interaction("any")), workspaceId, member)).toBe(false);
    expect(mockSurveyFindFirst).not.toHaveBeenCalled();
  });

  test("follows nested segment filters, at any depth and inside groups", async () => {
    const outer = "clouter0000000000000000001";
    const inner = "clinner0000000000000000001";
    vi.mocked(getSegment).mockImplementation(async (id: string) =>
      id === outer
        ? segment(outer, tree({ id: "g", connector: null, resource: tree(nestedSegment(inner)) }))
        : segment(inner, tree(interaction("specific", [restrictedId])))
    );
    mockSurveyFindFirst.mockResolvedValue({ id: restrictedId });

    expect(await segmentFiltersReadHiddenSurvey(tree(nestedSegment(outer)), workspaceId, member)).toBe(true);
    expect(mockSurveyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [restrictedId] } }) })
    );
  });

  test("skips what evaluation skips: itself, a missing segment and another workspace's segment", async () => {
    const self = "clself00000000000000000001";
    const missing = "clmissing00000000000000001";
    const foreign = "clforeign00000000000000001";
    vi.mocked(getSegment).mockImplementation(async (id: string) => {
      if (id === missing) throw new ResourceNotFoundError("segment", id);
      if (id === foreign) return segment(foreign, tree(interaction("specific", [restrictedId])), "ws-other");
      throw new Error(`unexpected lookup of ${id}`);
    });

    const result = await segmentFiltersReadHiddenSurvey(
      tree(nestedSegment(self), nestedSegment(missing), nestedSegment(foreign)),
      workspaceId,
      member,
      self
    );

    expect(result).toBe(false);
    expect(getSegment).toHaveBeenCalledTimes(2);
    expect(mockSurveyFindFirst).not.toHaveBeenCalled();
  });

  test("looks a large id set up in bounded batches and stops at the first hidden one", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `clsv${String(i).padStart(22, "0")}`);
    mockSurveyFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: ids[300] });

    expect(
      await segmentFiltersReadHiddenSurvey(tree(interaction("specific", ids)), workspaceId, member)
    ).toBe(true);
    expect(mockSurveyFindFirst).toHaveBeenCalledTimes(2);
    expect(mockSurveyFindFirst.mock.calls[0][0].where.id.in).toHaveLength(200);
  });

  // CodeRabbit on #9935: many references sharing one nested chain must not each walk it again.
  test("getSurveyIdsReadBySegments reads a chain shared by several segments once", async () => {
    const shared = "clshared00000000000000001";
    vi.mocked(getSegment).mockImplementation(async (id: string) =>
      segment(id, tree(interaction("specific", [restrictedId])))
    );
    const referencing = Array.from({ length: 5 }, (_, i) => ({
      id: `clref${String(i).padStart(21, "0")}`,
      filters: tree(nestedSegment(shared), interaction("specific", [visibleId])),
    }));

    const read = await getSurveyIdsReadBySegments(referencing, workspaceId);

    expect([...read].sort()).toEqual([restrictedId, visibleId].sort());
    expect(getSegment).toHaveBeenCalledTimes(1);
  });

  // CodeRabbit on #9935: a draft may store a non-id; it reads nothing and must not reach id validation.
  test("getSurveyIdsReadBySegments skips survey ids that are not ids", async () => {
    const read = await getSurveyIdsReadBySegments(
      [
        {
          id: "clseg0000000000000000001",
          filters: tree(interaction("specific", ["not an id", "", visibleId])),
        },
      ],
      workspaceId
    );

    expect([...read]).toEqual([visibleId]);
  });

  test("assertSegmentSurveyFiltersVisible turns a hidden survey into InvalidInputError", async () => {
    mockSurveyFindFirst.mockResolvedValue({ id: restrictedId });

    await expect(
      assertSegmentSurveyFiltersVisible(tree(interaction("specific", [restrictedId])), workspaceId, member)
    ).rejects.toThrow(new InvalidInputError(SEGMENT_FILTERS_READ_HIDDEN_SURVEY_MESSAGE));
  });
});
