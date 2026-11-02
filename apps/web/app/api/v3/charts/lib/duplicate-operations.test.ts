import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { getDashboardWorkspaceRow } from "@/app/api/v3/dashboards/lib/service";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { isNewReleaseWorkEnabled } from "@/lib/upgrade/compatibility";
import { duplicateV3Chart } from "./duplicate-operations";
import { duplicateChartRow } from "./duplicate-service";
import { type TChartResourceRow, getChartResourceRow } from "./service";

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
vi.mock("@/app/api/v3/dashboards/lib/service", () => ({ getDashboardWorkspaceRow: vi.fn() }));
vi.mock("./service", () => ({ getChartResourceRow: vi.fn() }));
vi.mock("./duplicate-service", () => ({ duplicateChartRow: vi.fn() }));
vi.mock("@/lib/upgrade/compatibility", () => ({ isNewReleaseWorkEnabled: vi.fn() }));

const sourceId = "clch000000000000000000001";
const copyId = "clch000000000000000000002";
const workspaceId = "clws000000000000000000001";
const organizationId = "clorg00000000000000000001";
const datasetId = "clds000000000000000000001";
const dashboardId = "cldb000000000000000000001";
const requestId = "req_1";
const instance = "/api/v3/charts/duplicate";

const session = { user: { id: "user_1" } } as unknown as TV3Authentication;
const access = { workspaceId, organizationId };

const rowOf = (overrides: Partial<TChartResourceRow> = {}): TChartResourceRow =>
  ({
    id: sourceId,
    workspaceId,
    feedbackDirectoryId: datasetId,
    name: "Weekly NPS",
    type: "bar",
    query: { measures: ["FeedbackRecords.npsScore"] },
    config: {},
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    creator: null,
    widgets: [],
    ...overrides,
  }) as TChartResourceRow;

const nameTaken = () =>
  new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "7" });

const duplicate = (body: Record<string, unknown> = {}, auditLog?: TV3AuditLog) =>
  duplicateV3Chart({
    chartId: sourceId,
    body: body as never,
    authentication: session,
    requestId,
    instance,
    auditLog,
  });

type TProblem = { code: string; detail: string; invalid_params?: { name: string; reason: string }[] };
const problemOf = async (response: Response) => (await response.json()) as TProblem;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getChartResourceRow).mockResolvedValue(rowOf());
  vi.mocked(requireDashboardsAccess).mockResolvedValue(access);
  vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValue(null);
  vi.mocked(isNewReleaseWorkEnabled).mockResolvedValue(true);
  vi.mocked(getDashboardWorkspaceRow).mockResolvedValue({ id: dashboardId, workspaceId });
  vi.mocked(duplicateChartRow).mockResolvedValue({
    kind: "ok",
    row: rowOf({ id: copyId, name: "Weekly NPS (copy)" }),
  });
});

describe("duplicateV3Chart", () => {
  test("copies the chart, attributed to the user, with a Location and an audit naming the source", async () => {
    const auditLog = {} as TV3AuditLog;

    const response = await duplicate({}, auditLog);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/charts/${copyId}`);
    expect(requireDashboardsAccess).toHaveBeenCalledWith(
      session,
      workspaceId,
      "readWrite",
      requestId,
      instance
    );
    expect(refuseUnlessFeedbackDatasetAccess).toHaveBeenCalledWith(
      session,
      access,
      datasetId,
      "readWrite",
      requestId,
      instance
    );
    expect(duplicateChartRow).toHaveBeenCalledWith({
      sourceId,
      name: undefined,
      createdBy: "user_1",
      dashboardId: undefined,
      layout: undefined,
    });
    expect(getDashboardWorkspaceRow).not.toHaveBeenCalled();
    const { data } = (await response.json()) as { data: { id: string; name: string } };
    expect(data).toMatchObject({ id: copyId, name: "Weekly NPS (copy)" });
    expect(auditLog).toMatchObject({ targetId: copyId, organizationId });
    expect(auditLog.newObject).toMatchObject({ id: copyId, duplicatedFrom: sourceId });
    expect(auditLog.newObject).not.toHaveProperty("dashboardId");
  });

  test("puts the copy on a dashboard of the same workspace and audits where it went", async () => {
    vi.mocked(duplicateChartRow).mockResolvedValue({
      kind: "ok",
      row: rowOf({ id: copyId }),
      widgetId: "clwg000000000000000000001",
    });
    const layout = { x: 0, y: 4, w: 4, h: 4 };
    const auditLog = {} as TV3AuditLog;

    const response = await duplicate({ dashboardId, layout }, auditLog);

    expect(response.status).toBe(201);
    expect(getDashboardWorkspaceRow).toHaveBeenCalledWith(dashboardId);
    expect(duplicateChartRow).toHaveBeenCalledWith(expect.objectContaining({ dashboardId, layout }));
    expect(auditLog.newObject).toMatchObject({
      duplicatedFrom: sourceId,
      dashboardId,
      widgetId: "clwg000000000000000000001",
    });
  });

  test("refuses a dashboard from another workspace, or one that does not exist, with 403", async () => {
    for (const dashboard of [{ id: dashboardId, workspaceId: "clws000000000000000000002" }, null]) {
      vi.mocked(getDashboardWorkspaceRow).mockResolvedValueOnce(dashboard);

      const response = await duplicate({ dashboardId });

      expect(response.status).toBe(403);
      expect((await problemOf(response)).code).toBe("forbidden");
    }
    expect(duplicateChartRow).not.toHaveBeenCalled();
  });

  test("copies nothing for a caller without write access to the chart or its dataset", async () => {
    vi.mocked(requireDashboardsAccess).mockResolvedValueOnce(
      problemForbidden(requestId, undefined, instance)
    );
    expect((await duplicate()).status).toBe(403);

    vi.mocked(refuseUnlessFeedbackDatasetAccess).mockResolvedValueOnce(
      problemForbidden(requestId, "You are not authorized to use this Feedback Dataset", instance)
    );
    expect((await duplicate()).status).toBe(403);

    vi.mocked(getChartResourceRow).mockResolvedValueOnce(null);
    expect((await duplicate()).status).toBe(403);

    expect(duplicateChartRow).not.toHaveBeenCalled();
  });

  test("refuses copying a matrix chart before the online upgrade finished", async () => {
    vi.mocked(getChartResourceRow).mockResolvedValue(rowOf({ type: "matrix" }));
    vi.mocked(isNewReleaseWorkEnabled).mockResolvedValue(false);

    const response = await duplicate();

    expect(response.status).toBe(422);
    expect((await problemOf(response)).invalid_params?.map((param) => param.name)).toEqual(["type"]);
    expect(duplicateChartRow).not.toHaveBeenCalled();
  });

  test("answers a taken name the caller chose with 409 at once", async () => {
    vi.mocked(duplicateChartRow).mockRejectedValue(nameTaken());

    const response = await duplicate({ name: "Taken" });

    expect(response.status).toBe(409);
    expect((await problemOf(response)).code).toBe("conflict");
    expect(duplicateChartRow).toHaveBeenCalledTimes(1);
  });

  test("retries a generated name a concurrent copy took, up to three attempts", async () => {
    vi.mocked(duplicateChartRow).mockRejectedValueOnce(nameTaken()).mockRejectedValueOnce(nameTaken());

    expect((await duplicate()).status).toBe(201);
    expect(duplicateChartRow).toHaveBeenCalledTimes(3);

    vi.mocked(duplicateChartRow).mockReset().mockRejectedValue(nameTaken());

    const exhausted = await duplicate();
    expect(exhausted.status).toBe(409);
    expect(duplicateChartRow).toHaveBeenCalledTimes(3);
  });

  test("answers a source or dashboard deleted meanwhile with 403", async () => {
    vi.mocked(duplicateChartRow).mockResolvedValue({ kind: "gone" });

    const response = await duplicate({ dashboardId });

    expect(response.status).toBe(403);
    expect((await problemOf(response)).code).toBe("forbidden");
  });

  test("refuses an overlapping layout with 422 naming layout and the widget in the way", async () => {
    vi.mocked(duplicateChartRow).mockResolvedValue({
      kind: "overlap",
      widgetId: "clwg000000000000000000007",
    });

    const response = await duplicate({ dashboardId, layout: { x: 0, y: 0, w: 4, h: 4 } });

    expect(response.status).toBe(422);
    const problem = await problemOf(response);
    expect(problem.code).toBe("unprocessable_content");
    expect(problem.invalid_params).toHaveLength(1);
    expect(problem.invalid_params?.[0].name).toBe("layout");
    expect(problem.invalid_params?.[0].reason).toContain("clwg000000000000000000007");
  });

  test("refuses a copy onto a dashboard already holding the most widgets it can with 409", async () => {
    vi.mocked(duplicateChartRow).mockResolvedValue({ kind: "full" });

    const response = await duplicate({ dashboardId });

    expect(response.status).toBe(409);
    expect((await problemOf(response)).code).toBe("conflict");
  });

  test("answers any other failure with a 500 that does not echo it", async () => {
    vi.mocked(duplicateChartRow).mockRejectedValue(new Error("relation secret_table"));

    const response = await duplicate();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret_table");
  });
});
