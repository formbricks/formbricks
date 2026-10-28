import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import {
  getIsFeedbackAnalyticsEnabled,
  getIsFeedbackDirectoriesEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { getV3FeedbackFieldCatalog, queryV3Feedback } from "./operations";
import { FEEDBACK_QUERY_RATE_LIMIT } from "./rate-limit";
import { V3_FEEDBACK_QUERY_DEFAULT_LIMIT, ZV3FeedbackQuery } from "./schemas";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() })) },
}));
vi.mock("@/app/api/v3/lib/auth", () => ({
  getV3AuthorizationActor: (authentication: { user?: { id: string }; apiKeyId?: string } | null) =>
    authentication?.user?.id
      ? { type: "user", id: authentication.user.id }
      : authentication?.apiKeyId
        ? { type: "apiKey", id: authentication.apiKeyId }
        : null,
  requireV3WorkspaceAccess: vi.fn(),
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsFeedbackAnalyticsEnabled: vi.fn(),
  getIsFeedbackDirectoriesEnabled: vi.fn(),
}));
vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: vi.fn(),
}));
vi.mock("@/modules/ee/analysis/api/lib/cube-client", () => {
  class CubeQueryError extends Error {
    constructor() {
      super("Cube query failed. Verify CUBEJS_API_URL and CUBEJS_API_SECRET");
    }
  }
  return { CubeQueryError, executeTenantScopedQuery: vi.fn() };
});

const workspaceId = "tz4a98xxat96iws9zmbrgj3a";
const organizationId = "org4a98xxat96iws9zmbrgj3a";
const ownDatasetId = "ds4a98xxat96iws9zmbrgj3aaa";
const otherOwnDatasetId = "ds4a98xxat96iws9zmbrgj3bbb";
const foreignDatasetId = "ds4a98xxat96iws9zmbrgj3ccc";

const session = { user: { id: "user_1" }, expires: "2099-01-01" } as unknown as TV3Authentication;
const apiKey = {
  apiKeyId: "key_1",
  organizationId,
  workspacePermissions: [],
} as unknown as TV3Authentication;

const baseParams = { workspaceId, requestId: "req_1", instance: "/api/v3/feedback-queries" };
const query = ZV3FeedbackQuery.parse({ measures: ["FeedbackRecords.npsScore"] });

const readJson = async (response: Response) => (await response.json()) as Record<string, unknown>;

const directories = (...ids: string[]) =>
  ids.map((id) => ({ id, name: `Dataset ${id.slice(-3)}` })) as Awaited<
    ReturnType<typeof getFeedbackDirectoriesByWorkspaceId>
  >;

describe("queryV3Feedback", () => {
  beforeEach(() => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({ workspaceId, organizationId });
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
    vi.mocked(getIsFeedbackAnalyticsEnabled).mockResolvedValue(true);
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue(directories(ownDatasetId));
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(applyRateLimit).mockResolvedValue(undefined as never);
    vi.mocked(executeTenantScopedQuery).mockResolvedValue([{ "FeedbackRecords.npsScore": 42 }]);
  });

  describe("tenancy", () => {
    test("queries the workspace's own dataset and hands it to Cube as the tenant, never as part of the query", async () => {
      const response = await queryV3Feedback({ ...baseParams, authentication: session, query });

      expect(response.status).toBe(200);
      const call = vi.mocked(executeTenantScopedQuery).mock.calls[0][0];
      expect(call).toMatchObject({
        feedbackDirectoryId: ownDatasetId,
        workspaceId,
        organizationId,
        userId: "user_1",
        actorType: "user",
        source: "feedbackQueries.execute",
      });
      expect(JSON.stringify(call.query)).not.toContain(ownDatasetId);
      expect(JSON.stringify(call.query)).not.toContain("tenantId");
    });

    test("a dataset the workspace does not hold is refused and Cube is never reached", async () => {
      const response = await queryV3Feedback({
        ...baseParams,
        authentication: session,
        query,
        datasetId: foreignDatasetId,
      });

      expect(response.status).toBe(403);
      expect(executeTenantScopedQuery).not.toHaveBeenCalled();
    });

    test("a dataset the caller's team has no assignment to is refused", async () => {
      vi.mocked(can).mockResolvedValue(false);

      const response = await queryV3Feedback({ ...baseParams, authentication: session, query });

      expect(response.status).toBe(403);
      expect(executeTenantScopedQuery).not.toHaveBeenCalled();
    });

    test("with several datasets the caller must name one, and the named one is the tenant", async () => {
      vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue(
        directories(ownDatasetId, otherOwnDatasetId)
      );

      const ambiguous = await queryV3Feedback({ ...baseParams, authentication: session, query });
      expect(ambiguous.status).toBe(400);
      expect(executeTenantScopedQuery).not.toHaveBeenCalled();

      const named = await queryV3Feedback({
        ...baseParams,
        authentication: session,
        query,
        datasetId: otherOwnDatasetId,
      });
      expect(named.status).toBe(200);
      expect(vi.mocked(executeTenantScopedQuery).mock.calls[0][0].feedbackDirectoryId).toBe(
        otherOwnDatasetId
      );
    });

    test("a workspace the caller cannot read answers the access refusal without touching Cube", async () => {
      vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(
        Response.json({ code: "forbidden" }, { status: 403 })
      );

      const response = await queryV3Feedback({ ...baseParams, authentication: session, query });

      expect(response.status).toBe(403);
      expect(executeTenantScopedQuery).not.toHaveBeenCalled();
    });

    test("an API key is attributed as an api actor", async () => {
      await queryV3Feedback({ ...baseParams, authentication: apiKey, query });

      expect(vi.mocked(executeTenantScopedQuery).mock.calls[0][0]).toMatchObject({
        userId: "key_1",
        actorType: "api",
      });
      expect(applyRateLimit).toHaveBeenCalledWith(FEEDBACK_QUERY_RATE_LIMIT, "key_1");
    });
  });

  describe("licence gate", () => {
    test("an organization without the analytics entitlement is refused before Cube", async () => {
      vi.mocked(getIsFeedbackAnalyticsEnabled).mockResolvedValue(false);

      const response = await queryV3Feedback({ ...baseParams, authentication: session, query });

      expect(response.status).toBe(403);
      expect((await readJson(response)).detail).toContain("not enabled");
      expect(getIsFeedbackAnalyticsEnabled).toHaveBeenCalledWith(organizationId);
      expect(executeTenantScopedQuery).not.toHaveBeenCalled();
      expect(applyRateLimit).not.toHaveBeenCalled();
    });

    test("without the feedback datasets entitlement the dataset cannot be resolved", async () => {
      vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(false);

      const response = await queryV3Feedback({ ...baseParams, authentication: session, query });

      expect(response.status).toBe(403);
      expect(executeTenantScopedQuery).not.toHaveBeenCalled();
    });
  });

  describe("what reaches Cube", () => {
    test("a query without a limit gets the default, and the response says which query ran", async () => {
      const response = await queryV3Feedback({ ...baseParams, authentication: session, query });
      const body = (await readJson(response)) as { data: { query: { limit: number }; rows: unknown[] } };

      expect(vi.mocked(executeTenantScopedQuery).mock.calls[0][0].query.limit).toBe(
        V3_FEEDBACK_QUERY_DEFAULT_LIMIT
      );
      expect(body.data.query.limit).toBe(V3_FEEDBACK_QUERY_DEFAULT_LIMIT);
      expect(body.data.rows).toEqual([{ "FeedbackRecords.npsScore": 42 }]);
    });

    test("an explicit limit is kept, and the response base column is not injected", async () => {
      await queryV3Feedback({
        ...baseParams,
        authentication: session,
        query: ZV3FeedbackQuery.parse({ measures: ["FeedbackRecords.npsScore"], limit: 7 }),
      });

      const call = vi.mocked(executeTenantScopedQuery).mock.calls[0][0];
      expect(call.query.limit).toBe(7);
      expect(call.includeResponseBase).toBe(false);
    });

    test("names the dataset the rows came from", async () => {
      const response = await queryV3Feedback({ ...baseParams, authentication: session, query });
      const body = (await readJson(response)) as { data: { datasetId: string; datasetName: string } };

      expect(body.data.datasetId).toBe(ownDatasetId);
      expect(body.data.datasetName).toBe("Dataset aaa");
    });
  });

  describe("failure modes", () => {
    test("the rate-limit bucket answers 429 with Retry-After and Cube is not reached", async () => {
      vi.mocked(applyRateLimit).mockRejectedValue(new TooManyRequestsError("Slow down", 12));

      const response = await queryV3Feedback({ ...baseParams, authentication: session, query });

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("12");
      expect(executeTenantScopedQuery).not.toHaveBeenCalled();
    });

    test("a Cube failure is a 502 that does not relay the deployment settings in the thrown message", async () => {
      const { CubeQueryError } = await import("@/modules/ee/analysis/api/lib/cube-client");
      vi.mocked(executeTenantScopedQuery).mockRejectedValue(new CubeQueryError());

      const response = await queryV3Feedback({ ...baseParams, authentication: session, query });
      const body = await readJson(response);

      expect(response.status).toBe(502);
      expect(JSON.stringify(body)).not.toContain("CUBEJS");
    });

    test("an unexpected throw is a 500 without its message", async () => {
      vi.mocked(executeTenantScopedQuery).mockRejectedValue(new Error("secret column name"));

      const response = await queryV3Feedback({ ...baseParams, authentication: session, query });

      expect(response.status).toBe(500);
      expect(JSON.stringify(await readJson(response))).not.toContain("secret column name");
    });
  });
});

describe("getV3FeedbackFieldCatalog", () => {
  beforeEach(() => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({ workspaceId, organizationId });
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
    vi.mocked(getIsFeedbackAnalyticsEnabled).mockResolvedValue(true);
  });

  test("returns the catalog the query schema validates against", async () => {
    const response = await getV3FeedbackFieldCatalog({ ...baseParams, authentication: session });
    const body = (await readJson(response)) as {
      data: { measures: { id: string }[]; dimensions: { id: string }[]; limits: { maxLimit: number } };
    };

    expect(response.status).toBe(200);
    expect(body.data.measures.map((measure) => measure.id)).toContain("FeedbackRecords.npsScore");
    expect(body.data.dimensions.map((dimension) => dimension.id)).not.toContain("FeedbackRecords.tenantId");
    // Every advertised member is accepted by the schema, so the two cannot drift.
    expect(
      ZV3FeedbackQuery.safeParse({
        measures: body.data.measures.slice(0, 10).map((measure) => measure.id),
        dimensions: body.data.dimensions.slice(0, 5).map((dimension) => dimension.id),
      }).success
    ).toBe(true);
    expect(body.data.limits.maxLimit).toBe(1000);
    expect(executeTenantScopedQuery).not.toHaveBeenCalled();
  });

  test("is refused without the analytics entitlement, like a query", async () => {
    vi.mocked(getIsFeedbackAnalyticsEnabled).mockResolvedValue(false);

    const response = await getV3FeedbackFieldCatalog({ ...baseParams, authentication: session });

    expect(response.status).toBe(403);
  });

  test("is refused when the caller cannot read the workspace", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(
      Response.json({ code: "forbidden" }, { status: 403 })
    );

    const response = await getV3FeedbackFieldCatalog({ ...baseParams, authentication: session });

    expect(response.status).toBe(403);
  });
});
