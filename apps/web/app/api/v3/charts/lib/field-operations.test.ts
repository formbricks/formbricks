import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { CubeQueryError, executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import { getV3ChartFieldCatalog, listV3ChartFieldValues } from "./field-operations";
import { ZV3ChartFieldCatalog } from "./resources";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock("@/app/api/v3/lib/dashboards-access", () => ({
  requireDashboardsAccess: vi.fn(),
  refuseUnlessFeedbackDatasetAccess: vi.fn(),
}));
vi.mock("@/app/api/v3/lib/auth", () => ({ getV3AuthorizationActor: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/ee/analysis/api/lib/cube-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/analysis/api/lib/cube-client")>()),
  executeTenantScopedQuery: vi.fn(),
}));

const workspaceId = "clws000000000000000000001";
const internalWorkspaceId = "clws000000000000000000009";
const organizationId = "clorg00000000000000000001";
const datasetId = "clds000000000000000000001";
const requestId = "req_1";
const instance = "/api/v3/charts/fields";
const LOOKUP_FIELD = "FeedbackRecords.sourceName";

const session = { user: { id: "user_1" } } as unknown as TV3Authentication;
const access = { workspaceId: internalWorkspaceId, organizationId };
const actor = { type: "user" as const, id: "user_1" };

type TProblem = {
  code: string;
  detail: string;
  invalid_params?: { name: string; reason: string; code?: string }[];
};
const problemOf = async (response: Response) => (await response.json()) as TProblem;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(applyRateLimit).mockResolvedValue(undefined as never);
  vi.mocked(requireDashboardsAccess).mockResolvedValue(access);
  vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValue(null);
  vi.mocked(getV3AuthorizationActor).mockReturnValue(actor);
});

describe("getV3ChartFieldCatalog", () => {
  const readCatalog = () =>
    getV3ChartFieldCatalog({ workspaceId, datasetId, authentication: session, requestId, instance });

  test("returns the catalog and date presets to a reader of the dataset in this workspace", async () => {
    const response = await readCatalog();

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: unknown };
    const catalog = ZV3ChartFieldCatalog.parse(data);
    expect(catalog.fields.map((field) => field.name)).toContain("FeedbackRecords.npsScore");
    expect(catalog.datePresets).toEqual(expect.arrayContaining(["last 7 days", "all-time"]));
    expect(requireDashboardsAccess).toHaveBeenCalledWith(session, workspaceId, "read", requestId, instance);
    expect(refuseUnlessFeedbackDatasetAccess).toHaveBeenCalledWith(
      session,
      access,
      datasetId,
      "read",
      requestId,
      instance
    );
  });

  test("passes the workspace and the dataset refusals through", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValueOnce(
      problemForbidden(requestId, undefined, instance)
    );
    expect((await readCatalog()).status).toBe(403);
    expect(refuseUnlessFeedbackDatasetAccess).not.toHaveBeenCalled();

    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValueOnce(
      problemForbidden(requestId, "You are not authorized to use this Feedback Dataset", instance)
    );
    const refused = await readCatalog();
    expect(refused.status).toBe(403);
    expect((await problemOf(refused)).detail).toBe("You are not authorized to use this Feedback Dataset");
  });

  test("maps an unexpected failure to 500", async () => {
    vi.mocked(requireDashboardsAccess).mockRejectedValue(new Error("boom"));

    expect((await readCatalog()).status).toBe(500);
  });
});

describe("listV3ChartFieldValues", () => {
  const lookup = (field: string = LOOKUP_FIELD, query: Record<string, unknown> = {}) =>
    listV3ChartFieldValues({
      field,
      query: { workspaceId, datasetId, ...query } as never,
      authentication: session,
      requestId,
      instance,
    });

  test("returns distinct trimmed values, from a query run in the authorized workspace's tenant", async () => {
    vi.mocked(executeTenantScopedQuery).mockResolvedValue([
      { [LOOKUP_FIELD]: " Web " },
      { [LOOKUP_FIELD]: "Web" },
      { [LOOKUP_FIELD]: "Webinar" },
    ] as never);

    const response = await lookup(LOOKUP_FIELD, { search: "web" });

    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: unknown }).data).toEqual([
      { value: "Web" },
      { value: "Webinar" },
    ]);
    expect(executeTenantScopedQuery).toHaveBeenCalledWith({
      query: expect.objectContaining({
        dimensions: [LOOKUP_FIELD],
        limit: 100,
        filters: [{ member: LOOKUP_FIELD, operator: "contains", values: ["web"] }],
      }),
      feedbackDirectoryId: datasetId,
      workspaceId: internalWorkspaceId,
      organizationId,
      actor,
      source: "v3.charts.fieldValues",
    });
    expect(applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3ChartQueries, "user_1");
  });

  test("stops at 429 when the chart-query budget is spent, before checking access", async () => {
    vi.mocked(applyRateLimit).mockRejectedValue(new TooManyRequestsError("Maximum number of requests", 12));

    const response = await lookup();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(requireDashboardsAccess).not.toHaveBeenCalled();
  });

  test("refuses a field outside the catalog, or one that is not a pick-list, with 422 invalid_reference", async () => {
    for (const field of ["FeedbackRecords.tenantId", "FeedbackRecords.valueText"]) {
      const response = await lookup(field);

      expect(response.status).toBe(422);
      expect((await problemOf(response)).invalid_params).toEqual([
        expect.objectContaining({ name: "field", code: "invalid_reference" }),
      ]);
    }
    expect(executeTenantScopedQuery).not.toHaveBeenCalled();
  });

  test("runs nothing for a caller refused by the workspace or the dataset", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValueOnce(
      problemForbidden(requestId, undefined, instance)
    );
    expect((await lookup()).status).toBe(403);

    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValueOnce(
      problemForbidden(requestId, undefined, instance)
    );
    expect((await lookup()).status).toBe(403);

    expect(executeTenantScopedQuery).not.toHaveBeenCalled();
  });

  test("answers 401 when no actor can be attributed", async () => {
    vi.mocked(getV3AuthorizationActor).mockReturnValue(null);

    const response = await lookup();

    expect(response.status).toBe(401);
    expect(executeTenantScopedQuery).not.toHaveBeenCalled();
  });

  test("answers a Cube failure with 502, saying whether it timed out, never with Cube's error", async () => {
    vi.mocked(executeTenantScopedQuery).mockRejectedValueOnce(new CubeQueryError(true));
    const timedOut = await lookup();
    expect(timedOut.status).toBe(502);
    expect(await problemOf(timedOut)).toMatchObject({
      code: "bad_gateway",
      detail: "The value lookup took too long and was stopped.",
    });

    vi.mocked(executeTenantScopedQuery).mockRejectedValueOnce(new CubeQueryError(false));
    const failed = await lookup();
    expect(failed.status).toBe(502);
    expect((await problemOf(failed)).detail).toBe("The values could not be looked up. Try again shortly.");
  });

  test("maps any other failure to 500", async () => {
    vi.mocked(executeTenantScopedQuery).mockRejectedValue(new Error("boom"));

    expect((await lookup()).status).toBe(500);
  });
});
