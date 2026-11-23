import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { GET } from "./route";

/**
 * The Test run picker's list behind the route: session-only authentication, write access on the
 * workflow, the survey taken from the workflow's trigger and scoped to its workspace, survey
 * visibility, keyset paging and the row shape.
 */
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authenticateRequest: vi.fn(),
  applyRateLimit: vi.fn(),
  requireV3WorkspaceAccess: vi.fn(),
  getIsWorkflowsEnabled: vi.fn(),
  isOrganizationAdmin: vi.fn(),
  workflowFindUnique: vi.fn(),
  surveyFindUnique: vi.fn(),
  surveyFindMany: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/app/api/v3/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/v3/lib/auth")>()),
  requireV3WorkspaceAccess: mocks.requireV3WorkspaceAccess,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsWorkflowsEnabled: mocks.getIsWorkflowsEnabled,
}));
vi.mock("@/lib/authorization", () => ({ can: mocks.isOrganizationAdmin }));
vi.mock("@formbricks/database", () => ({
  prisma: {
    workflow: { findUnique: mocks.workflowFindUnique },
    survey: { findUnique: mocks.surveyFindUnique, findMany: mocks.surveyFindMany },
    $queryRaw: mocks.queryRaw,
  },
}));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn().mockResolvedValue("org_1"),
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
// The real hash: the global setup's fake one breaks the cursor's filter fingerprint.
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());
vi.mock("@formbricks/logger", () => {
  const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  return { logger: { ...log, withContext: vi.fn(() => log) } };
});

const WORKFLOW_ID = "cm9zr4t2b000208l8h2m1aq3c";
const WORKSPACE_ID = "cm9zr4mps000008l8btfy1vtz";
const SURVEY_ID = "cm9zr4q7i000108l84gozfggr";

const responseTrigger = {
  id: "trigger",
  type: "trigger",
  triggerType: "response.completed",
  config: { surveyId: SURVEY_ID, endingCardIds: [] },
};

const get = (query = "") =>
  GET(new NextRequest(`http://localhost/api/internal/workflows/${WORKFLOW_ID}/test-responses${query}`), {
    params: Promise.resolve({ workflowId: WORKFLOW_ID }),
  });

/** `count` rows, newest first, one second apart: odd ones partial, every one answering q2 only. */
const makeRows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `cm9zr5res0000000000000${String(index).padStart(3, "0")}`,
    created_at: new Date(Date.UTC(2026, 10, 16, 12, 0, 59 - index)),
    finished: index % 2 === 0,
    endingId: null,
    data: { q2: `answer ${index}`, hidden: "x" },
  }));

/** The SQL the route ran, rebuilt from the tagged template so its bound values can be read. */
const lastQuery = () => {
  const [strings, ...values] = mocks.queryRaw.mock.calls.at(-1) as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "cm9zr52kh000508l8e3q7bw9j" }, expires: "2099-01-01" });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.requireV3WorkspaceAccess.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: "org_1" });
  mocks.getIsWorkflowsEnabled.mockResolvedValue(true);
  mocks.isOrganizationAdmin.mockResolvedValue(true);
  mocks.workflowFindUnique.mockResolvedValue({
    id: WORKFLOW_ID,
    workspaceId: WORKSPACE_ID,
    status: "draft",
    definition: { schemaVersion: 1, trigger: responseTrigger, nodes: [], edges: [] },
  });
  mocks.surveyFindUnique.mockResolvedValue({
    blocks: [{ id: "b1", elements: [{ id: "q1" }, { id: "q2" }] }],
  });
  mocks.surveyFindMany.mockResolvedValue([]);
  mocks.queryRaw.mockResolvedValue(makeRows(21));
});

describe("GET /api/internal/workflows/{workflowId}/test-responses", () => {
  test("lists 20 of the trigger survey's responses, newest first, with a cursor to the next page", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Record<string, unknown>[];
      meta: { nextCursor: string | null };
    };
    expect(body.data).toHaveLength(20);
    expect(body.data[0]).toEqual({
      id: "cm9zr5res0000000000000000",
      createdAt: "2026-11-16T12:00:59.000Z",
      finished: true,
      endingId: null,
      firstAnswer: "answer 0",
    });
    expect(body.data[1]).toMatchObject({ finished: false });
    expect(body.meta.nextCursor).toEqual(expect.any(String));

    // The survey is the trigger's, looked up within the workflow's workspace.
    expect(mocks.surveyFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_workspaceId: { id: SURVEY_ID, workspaceId: WORKSPACE_ID } } })
    );
    const query = lastQuery();
    expect(query.sql).toContain('r."surveyId" = ?');
    expect(query.sql).toContain('ORDER BY r."created_at" DESC, r."id" DESC');
    expect(query.values).toEqual([SURVEY_ID, 21]);
  });

  test("the next page continues after the last row of the previous one", async () => {
    const first = (await (await get()).json()) as { meta: { nextCursor: string } };
    mocks.queryRaw.mockResolvedValue(makeRows(3));

    const response = await get(`?cursor=${first.meta.nextCursor}`);

    expect(response.status).toBe(200);
    expect(((await response.json()) as { meta: unknown }).meta).toEqual({ nextCursor: null });
    expect(lastQuery().values).toEqual([
      SURVEY_ID,
      new Date("2026-11-16T12:00:40.000Z"),
      "cm9zr5res0000000000000019",
      21,
    ]);
  });

  test("refuses a cursor that is not one of its own", async () => {
    const response = await get("?cursor=not-a-cursor");

    expect(response.status).toBe(400);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  test("needs write access on the workflow", async () => {
    mocks.requireV3WorkspaceAccess.mockResolvedValue(
      Response.json(
        { code: "forbidden" },
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    expect((await get()).status).toBe(403);
    expect(mocks.requireV3WorkspaceAccess.mock.calls[0][2]).toBe("readWrite");
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  test("refuses a survey outside the workspace and one the caller may not read", async () => {
    mocks.surveyFindUnique.mockResolvedValueOnce(null);
    expect((await get()).status).toBe(403);

    mocks.isOrganizationAdmin.mockResolvedValue(false);
    mocks.surveyFindMany.mockResolvedValue([{ id: SURVEY_ID }]);
    expect((await get()).status).toBe(403);

    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  test("a workflow without a Response completed trigger has no responses to list", async () => {
    mocks.workflowFindUnique.mockResolvedValue({
      id: WORKFLOW_ID,
      workspaceId: WORKSPACE_ID,
      status: "draft",
      definition: {
        schemaVersion: 1,
        trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {} },
        nodes: [],
        edges: [],
      },
    });

    expect((await get()).status).toBe(422);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  test("is session-only", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.authenticateRequest.mockResolvedValue({ type: "apiKey", apiKeyId: "key_1" });

    expect((await get()).status).toBe(401);
  });
});
