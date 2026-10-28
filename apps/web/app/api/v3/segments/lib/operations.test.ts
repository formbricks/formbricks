import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { computeFilterFingerprint, encodeKeysetCursor } from "@/app/api/v3/lib/keyset-cursor";
import { V3SurveyReferenceValidationError } from "@/app/api/v3/surveys/reference-validation";
import { assertV3SurveyTargetingFilterReferences } from "@/app/api/v3/surveys/targeting";
import { checkForRecursiveSegmentFilter } from "@/modules/ee/contacts/segments/lib/helper";
import {
  createSegment,
  deleteSegment,
  getSegment,
  updateSegment,
} from "@/modules/ee/contacts/segments/lib/segments";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  createV3Segment,
  createV3SegmentFromRawInput,
  deleteV3Segment,
  getV3Segment,
  listV3Segments,
  updateV3Segment,
  updateV3SegmentFromRawInput,
} from "./operations";
import {
  SEGMENT_LIST_KIND,
  SEGMENT_LIST_SORT,
  findSegmentIdByTitle,
  getSegmentSurveyRefs,
  listSegmentRows,
} from "./service";

vi.mock("server-only", () => ({}));
// The real `createHash`: `vitestSetup.ts` replaces it with a constant, which would void the cursor binding.
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn() }));
vi.mock("@/app/api/v3/responses/lib/visibility", () => ({
  resolveV3ResponsesActorContext: async () => ({ enforced: false, kind: "apiKey" }),
}));
vi.mock("@/app/api/v3/surveys/targeting", () => ({ assertV3SurveyTargetingFilterReferences: vi.fn() }));
vi.mock("@/modules/ee/contacts/segments/lib/helper", () => ({ checkForRecursiveSegmentFilter: vi.fn() }));
vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  createSegment: vi.fn(),
  deleteSegment: vi.fn(),
  getSegment: vi.fn(),
  updateSegment: vi.fn(),
}));
vi.mock("./service", () => ({
  SEGMENT_LIST_KIND: "segments.list",
  SEGMENT_LIST_SORT: "-createdAt",
  listSegmentRows: vi.fn(),
  getSegmentSurveyRefs: vi.fn(),
  findSegmentIdByTitle: vi.fn(),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const workspaceId = "clxx1234567890123456789012";
const organizationId = "clzz1234567890123456789012";
const segmentId = "clsg1234567890123456789012";
const otherSegmentId = "clsh1234567890123456789012";

const filters = [
  {
    id: "f1",
    connector: null,
    resource: {
      id: "f2",
      root: { type: "attribute" as const, contactAttributeKey: "plan" },
      qualifier: { operator: "equals" as const },
      value: "pro",
    },
  },
];

const segment = (overrides: Record<string, unknown> = {}) => ({
  id: segmentId,
  workspaceId,
  title: "Pro users",
  description: null,
  isPrivate: false,
  filters,
  surveys: [] as string[],
  activeSurveys: [],
  inactiveSurveys: [],
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T11:00:00.000Z"),
  ...overrides,
});

const base = { authentication: null, requestId: "req_1", instance: "/api/v3/segments" };
const NOT_ENABLED = "The contacts feature is not enabled for this organization.";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getIsContactsEnabled).mockResolvedValue(true);
  vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({ workspaceId, organizationId } as Awaited<
    ReturnType<typeof requireV3WorkspaceAccess>
  >);
  vi.mocked(getSegmentSurveyRefs).mockResolvedValue([]);
  vi.mocked(findSegmentIdByTitle).mockResolvedValue(null);
});

describe("entitlement and workspace access, on every operation", () => {
  const calls: [string, () => Promise<Response>][] = [
    ["list", () => listV3Segments({ ...base, query: { workspaceId, limit: 20 } })],
    ["get", () => getV3Segment({ ...base, segmentId })],
    ["create", () => createV3Segment({ ...base, body: { workspaceId, title: "T", filters } })],
    ["update", () => updateV3Segment({ ...base, segmentId, body: { title: "T" } })],
    ["delete", () => deleteV3Segment({ ...base, segmentId })],
  ];

  const writes = () => [createSegment, updateSegment, deleteSegment, listSegmentRows];

  test.each(calls)("%s answers the entitlement refusal and changes nothing", async (_name, call) => {
    vi.mocked(getSegment).mockResolvedValue(segment());
    vi.mocked(getIsContactsEnabled).mockResolvedValue(false);

    const response = await call();

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "forbidden", detail: NOT_ENABLED });
    for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
  });

  test.each(calls)(
    "%s stops at a workspace the caller cannot reach, before the entitlement",
    async (_name, call) => {
      vi.mocked(getSegment).mockResolvedValue(segment());
      vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));

      expect((await call()).status).toBe(403);
      expect(getIsContactsEnabled).not.toHaveBeenCalled();
      for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
    }
  );

  test("reads ask for read access and mutations for readWrite", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment());
    vi.mocked(listSegmentRows).mockResolvedValue({ page: [], nextCursor: null });
    vi.mocked(createSegment).mockResolvedValue(segment() as never);
    vi.mocked(updateSegment).mockResolvedValue(segment() as never);

    const levels: string[] = [];
    for (const [, call] of calls) {
      vi.mocked(requireV3WorkspaceAccess).mockClear();
      await call();
      levels.push(vi.mocked(requireV3WorkspaceAccess).mock.calls[0][2]);
    }

    expect(levels).toEqual(["read", "read", "readWrite", "readWrite", "readWrite"]);
  });
});

describe("tenant scoping of id-addressed operations", () => {
  test("an unknown segment answers 403, as one of another tenant does", async () => {
    vi.mocked(getSegment).mockRejectedValue(new ResourceNotFoundError("segment", segmentId));

    const response = await getV3Segment({ ...base, segmentId });

    expect(response.status).toBe(403);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
  });

  test("a private segment is not reachable here, and answers like an unknown one", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment({ isPrivate: true }));

    for (const call of [
      () => getV3Segment({ ...base, segmentId }),
      () => updateV3Segment({ ...base, segmentId, body: { title: "T" } }),
      () => deleteV3Segment({ ...base, segmentId }),
    ]) {
      expect((await call()).status).toBe(403);
    }
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
    expect(updateSegment).not.toHaveBeenCalled();
    expect(deleteSegment).not.toHaveBeenCalled();
  });

  test("authorizes against the segment's own workspace", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment());

    await getV3Segment({ ...base, segmentId });

    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      null,
      workspaceId,
      "read",
      "req_1",
      "/api/v3/segments"
    );
  });

  test("the surveys named are read through the caller's visibility, within the workspace", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment());
    vi.mocked(getSegmentSurveyRefs).mockResolvedValue([{ id: "s1", name: "NPS", status: "inProgress" }]);

    const body = await (await getV3Segment({ ...base, segmentId })).json();

    expect(body.data.surveys).toEqual([{ id: "s1", name: "NPS", status: "inProgress" }]);
    expect(getSegmentSurveyRefs).toHaveBeenCalledWith(segmentId, workspaceId, {});
  });
});

describe("listV3Segments", () => {
  test("lists the workspace's page with its limit and cursor", async () => {
    vi.mocked(listSegmentRows).mockResolvedValue({
      page: [{ ...segment(), filters: undefined } as never],
      nextCursor: "next",
    });

    const body = await (await listV3Segments({ ...base, query: { workspaceId, limit: 7 } })).json();

    expect(body.meta).toEqual({ limit: 7, nextCursor: "next" });
    expect(body.data[0]).toEqual({
      id: segmentId,
      workspaceId,
      title: "Pro users",
      description: null,
      createdAt: "2026-04-21T10:00:00.000Z",
      updatedAt: "2026-04-21T11:00:00.000Z",
    });
    expect(listSegmentRows).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, limit: 7, cursor: null })
    );
  });

  test("a malformed cursor, or one from a cursor of another collection, is a 400", async () => {
    const bad = await listV3Segments({ ...base, query: { workspaceId, limit: 20, cursor: "junk" } });
    expect(bad.status).toBe(400);

    const foreign = encodeKeysetCursor({
      version: 1,
      kind: "contacts.list",
      sortBy: SEGMENT_LIST_SORT,
      fp: computeFilterFingerprint({ workspaceId }),
      value: "2026-04-21T10:00:00.000Z",
      id: segmentId,
    });
    const other = await listV3Segments({ ...base, query: { workspaceId, limit: 20, cursor: foreign } });
    expect(other.status).toBe(400);
    expect(listSegmentRows).not.toHaveBeenCalled();
  });

  test("accepts a cursor it issued", async () => {
    vi.mocked(listSegmentRows).mockResolvedValue({ page: [], nextCursor: null });
    const cursor = encodeKeysetCursor({
      version: 1,
      kind: SEGMENT_LIST_KIND,
      sortBy: SEGMENT_LIST_SORT,
      fp: computeFilterFingerprint({ workspaceId }),
      value: "2026-04-21T10:00:00.000Z",
      id: segmentId,
    });

    const response = await listV3Segments({ ...base, query: { workspaceId, limit: 20, cursor } });

    expect(response.status).toBe(200);
    expect(listSegmentRows).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: expect.objectContaining({ id: segmentId }) })
    );
  });
});

describe("createV3Segment", () => {
  test("creates a reusable segment not attached to any survey", async () => {
    vi.mocked(createSegment).mockResolvedValue(segment() as never);

    const response = await createV3Segment({
      ...base,
      body: { workspaceId, title: "Pro users", description: "Paying", filters },
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/segments/${segmentId}`);
    expect(createSegment).toHaveBeenCalledWith({
      workspaceId,
      title: "Pro users",
      description: "Paying",
      isPrivate: false,
      filters,
      surveyId: "",
    });
  });

  test("a taken title is a 409 and nothing is created", async () => {
    vi.mocked(findSegmentIdByTitle).mockResolvedValue(otherSegmentId);

    const response = await createV3Segment({ ...base, body: { workspaceId, title: "Pro users", filters } });

    expect(response.status).toBe(409);
    expect(createSegment).not.toHaveBeenCalled();
  });

  test("filters that point at nothing are a 422 naming the node under `filters`", async () => {
    vi.mocked(assertV3SurveyTargetingFilterReferences).mockRejectedValue(
      new V3SurveyReferenceValidationError([
        {
          name: "targeting.filters.0.resource.root.contactAttributeKey",
          reason: "Contact attribute key 'plan' was not found in this workspace",
          code: "invalid_reference",
        },
      ])
    );

    const response = await createV3Segment({ ...base, body: { workspaceId, title: "T", filters } });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.invalid_params[0]).toMatchObject({
      name: "filters.0.resource.root.contactAttributeKey",
      code: "invalid_reference",
    });
    expect(createSegment).not.toHaveBeenCalled();
  });

  test("validates the references in the authorized workspace, not a requested one", async () => {
    vi.mocked(createSegment).mockResolvedValue(segment() as never);

    await createV3Segment({ ...base, body: { workspaceId, title: "T", filters } });

    expect(assertV3SurveyTargetingFilterReferences).toHaveBeenCalledWith(workspaceId, filters, {});
  });
});

describe("updateV3Segment", () => {
  test("changes only what was sent", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment());
    vi.mocked(updateSegment).mockResolvedValue(segment({ title: "Renamed" }) as never);

    const response = await updateV3Segment({ ...base, segmentId, body: { title: "Renamed" } });

    expect(response.status).toBe(200);
    expect(updateSegment).toHaveBeenCalledWith(segmentId, { title: "Renamed" });
    expect(assertV3SurveyTargetingFilterReferences).not.toHaveBeenCalled();
  });

  test("description null clears it", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment({ description: "old" }));
    vi.mocked(updateSegment).mockResolvedValue(segment() as never);

    await updateV3Segment({ ...base, segmentId, body: { description: null } });

    expect(updateSegment).toHaveBeenCalledWith(segmentId, { description: null });
  });

  test("a title held by another segment is a 409, the segment's own title is not", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment());
    vi.mocked(updateSegment).mockResolvedValue(segment() as never);

    vi.mocked(findSegmentIdByTitle).mockResolvedValue(otherSegmentId);
    expect((await updateV3Segment({ ...base, segmentId, body: { title: "Taken" } })).status).toBe(409);
    expect(updateSegment).not.toHaveBeenCalled();

    vi.mocked(findSegmentIdByTitle).mockResolvedValue(segmentId);
    expect((await updateV3Segment({ ...base, segmentId, body: { title: "Taken" } })).status).toBe(200);
  });

  test("new filters are checked for references and for referencing the segment itself", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment());
    vi.mocked(updateSegment).mockResolvedValue(segment() as never);

    await updateV3Segment({ ...base, segmentId, body: { filters } });

    expect(assertV3SurveyTargetingFilterReferences).toHaveBeenCalledWith(workspaceId, filters, {});
    expect(checkForRecursiveSegmentFilter).toHaveBeenCalledWith(filters, segmentId);
  });

  test("a recursive filter is a 422, not a server error", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment());
    vi.mocked(checkForRecursiveSegmentFilter).mockRejectedValue(
      new InvalidInputError("Recursive segment filter is not allowed")
    );

    const response = await updateV3Segment({ ...base, segmentId, body: { filters } });

    expect(response.status).toBe(422);
    expect(updateSegment).not.toHaveBeenCalled();
  });
});

describe("deleteV3Segment", () => {
  test("is refused with a 409 naming the visible surveys while any survey uses the segment", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment({ surveys: ["s1", "s2"] }));
    vi.mocked(getSegmentSurveyRefs).mockResolvedValue([{ id: "s1", name: "NPS", status: "inProgress" }]);

    const response = await deleteV3Segment({ ...base, segmentId });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("conflict");
    // s2 is a survey the caller cannot see: it counts toward the refusal and is not named.
    expect(body.details.surveys).toEqual([{ id: "s1", name: "NPS", status: "inProgress" }]);
    expect(deleteSegment).not.toHaveBeenCalled();
  });

  test("deletes an unused segment and answers its id", async () => {
    vi.mocked(getSegment).mockResolvedValue(segment());
    const auditLog = {} as NonNullable<Parameters<typeof deleteV3Segment>[0]["auditLog"]>;

    const response = await deleteV3Segment({ ...base, segmentId, auditLog });

    expect((await response.json()).data).toEqual({ id: segmentId });
    expect(deleteSegment).toHaveBeenCalledWith(segmentId);
    expect(auditLog).toMatchObject({ organizationId, targetId: segmentId });
  });
});

describe("the raw-input variants used by MCP", () => {
  test("refuse an invalid tree with a 400 naming the field, before any access check", async () => {
    const response = await createV3SegmentFromRawInput({
      ...base,
      body: { workspaceId, title: "T", filters: [{ id: "f1", connector: "and", resource: {} }] },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.invalid_params.length).toBeGreaterThan(0);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
  });

  test("refuse an empty tree, and an update that changes nothing", async () => {
    expect(
      (await createV3SegmentFromRawInput({ ...base, body: { workspaceId, title: "T", filters: [] } })).status
    ).toBe(400);
    expect((await updateV3SegmentFromRawInput({ ...base, segmentId, body: {} })).status).toBe(400);
  });

  test("hand a valid body to the operation", async () => {
    vi.mocked(createSegment).mockResolvedValue(segment() as never);

    const response = await createV3SegmentFromRawInput({
      ...base,
      body: { workspaceId, title: "T", filters },
    });

    expect(response.status).toBe(201);
  });
});
