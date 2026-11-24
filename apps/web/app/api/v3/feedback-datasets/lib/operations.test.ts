import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireV3OrganizationAccess } from "@/app/api/v3/lib/organization-access";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import {
  DatasetViewerAccessConflictError,
  DatasetViewerAccessInvalidError,
  type TDatasetViewerAccess,
  getDatasetOrganizationId,
  getDatasetViewerAccess,
  replaceDatasetViewerAccess,
} from "@/modules/ee/dashboard-access/lib/dataset-viewer-access";
import { getIsDashboardViewerRoleEnabled } from "@/modules/ee/license-check/lib/utils";
import { getV3DatasetViewerAccess, replaceV3DatasetViewerAccess } from "./operations";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/organization-access", () => ({ requireV3OrganizationAccess: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDashboardViewerRoleEnabled: vi.fn() }));
vi.mock("@/modules/ee/dashboard-access/lib/dataset-viewer-access", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/ee/dashboard-access/lib/dataset-viewer-access")>();
  return {
    DatasetViewerAccessConflictError: actual.DatasetViewerAccessConflictError,
    DatasetViewerAccessInvalidError: actual.DatasetViewerAccessInvalidError,
    getDatasetOrganizationId: vi.fn(),
    getDatasetViewerAccess: vi.fn(),
    replaceDatasetViewerAccess: vi.fn(),
  };
});

const organizationId = "clorg00000000000000000001";
const datasetId = "clds000000000000000000001";
const base = { authentication: null, datasetId, requestId: "req_1", instance: "/api/v3/x" };
const t0 = new Date("2026-11-01T10:00:00.000Z");
const t1 = new Date("2026-11-02T10:00:00.000Z");

const access = (updatedAt: Date, join: "all" | "any" = "all"): TDatasetViewerAccess => ({
  datasetId,
  join,
  updatedAt,
  conditions: [
    {
      field: "FeedbackRecords.metadataCountry",
      fieldLabel: "Country",
      attributeKeyId: null,
      attributeLabel: "Email",
    },
  ],
});

const requestBody = {
  join: "any" as const,
  conditions: [{ field: "FeedbackRecords.metadataCountry", attributeKeyId: null }],
  expectedUpdatedAt: t0.toISOString(),
};

type TJsonBody = { code?: string; details?: unknown; invalid_params?: unknown; data?: unknown };
const json = async (response: Response) => (await response.json()) as TJsonBody;

const grant = () => {
  vi.mocked(getDatasetOrganizationId).mockResolvedValue(organizationId);
  vi.mocked(requireV3OrganizationAccess).mockResolvedValue({ organizationId });
  vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(true);
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("authorization", () => {
  test("answers 403 for a dataset that does not exist, without asking for access", async () => {
    vi.mocked(getDatasetOrganizationId).mockResolvedValue(null);
    expect((await getV3DatasetViewerAccess(base)).status).toBe(403);
    expect(requireV3OrganizationAccess).not.toHaveBeenCalled();
  });

  test("relays the access refusal", async () => {
    vi.mocked(getDatasetOrganizationId).mockResolvedValue(organizationId);
    vi.mocked(requireV3OrganizationAccess).mockResolvedValue(new Response(null, { status: 401 }));
    expect((await replaceV3DatasetViewerAccess({ ...base, body: requestBody })).status).toBe(401);
    expect(replaceDatasetViewerAccess).not.toHaveBeenCalled();
  });

  test("answers dashboard_access_plan_required without Access Control and Dashboards", async () => {
    vi.mocked(getDatasetOrganizationId).mockResolvedValue(organizationId);
    vi.mocked(requireV3OrganizationAccess).mockResolvedValue({ organizationId });
    vi.mocked(getIsDashboardViewerRoleEnabled).mockResolvedValue(false);
    const response = await getV3DatasetViewerAccess(base);
    expect(response.status).toBe(403);
    expect((await json(response)).code).toBe("dashboard_access_plan_required");
  });

  test("asks read of the read and write of the replace", async () => {
    grant();
    vi.mocked(getDatasetViewerAccess).mockResolvedValue(access(t0));
    vi.mocked(replaceDatasetViewerAccess).mockResolvedValue({ before: access(t0), after: access(t1) });
    await getV3DatasetViewerAccess(base);
    await replaceV3DatasetViewerAccess({ ...base, body: requestBody });
    expect(vi.mocked(requireV3OrganizationAccess).mock.calls.map((call) => call[2])).toEqual([
      "read",
      "write",
    ]);
  });
});

describe("getV3DatasetViewerAccess", () => {
  test("serializes the access with an ISO updatedAt", async () => {
    grant();
    vi.mocked(getDatasetViewerAccess).mockResolvedValue(access(t0));
    const response = await getV3DatasetViewerAccess(base);
    expect(response.status).toBe(200);
    expect((await json(response)).data).toEqual({ ...access(t0), updatedAt: t0.toISOString() });
    expect(getDatasetViewerAccess).toHaveBeenCalledWith(organizationId, datasetId);
  });

  test("answers 403 when the dataset is not the organization's", async () => {
    grant();
    vi.mocked(getDatasetViewerAccess).mockResolvedValue(null);
    expect((await getV3DatasetViewerAccess(base)).status).toBe(403);
  });
});

describe("replaceV3DatasetViewerAccess", () => {
  test("replaces, answers the new access and audits before and after", async () => {
    grant();
    vi.mocked(replaceDatasetViewerAccess).mockResolvedValue({ before: access(t0), after: access(t1, "any") });
    const auditLog = {} as TV3AuditLog;

    const response = await replaceV3DatasetViewerAccess({ ...base, body: requestBody, auditLog });

    expect(response.status).toBe(200);
    expect((await json(response)).data).toMatchObject({ join: "any", updatedAt: t1.toISOString() });
    expect(replaceDatasetViewerAccess).toHaveBeenCalledWith(
      organizationId,
      datasetId,
      { join: "any", conditions: requestBody.conditions },
      t0
    );
    expect(auditLog).toMatchObject({
      organizationId,
      targetId: datasetId,
      oldObject: { dashboardViewerAccess: { updatedAt: t0.toISOString() } },
      newObject: { dashboardViewerAccess: { updatedAt: t1.toISOString(), join: "any" } },
    });
  });

  test("answers 403 when the dataset is gone by the write", async () => {
    grant();
    vi.mocked(replaceDatasetViewerAccess).mockResolvedValue(null);
    expect((await replaceV3DatasetViewerAccess({ ...base, body: requestBody })).status).toBe(403);
  });

  test("answers 409 with the current updatedAt when stale", async () => {
    grant();
    vi.mocked(replaceDatasetViewerAccess).mockRejectedValue(new DatasetViewerAccessConflictError(t1));
    const response = await replaceV3DatasetViewerAccess({ ...base, body: requestBody });
    expect(response.status).toBe(409);
    expect((await json(response)).details).toEqual({ currentUpdatedAt: t1.toISOString() });
  });

  test("answers 422 naming each invalid condition", async () => {
    grant();
    const issues = [
      { name: "conditions[0].attributeKeyId", reason: "is not a Member attribute of this organization" },
    ];
    vi.mocked(replaceDatasetViewerAccess).mockRejectedValue(new DatasetViewerAccessInvalidError(issues));
    const response = await replaceV3DatasetViewerAccess({ ...base, body: requestBody });
    expect(response.status).toBe(422);
    expect((await json(response)).invalid_params).toEqual(issues);
  });

  test("rethrows an unexpected error", async () => {
    grant();
    vi.mocked(replaceDatasetViewerAccess).mockRejectedValue(new Error("boom"));
    await expect(replaceV3DatasetViewerAccess({ ...base, body: requestBody })).rejects.toThrow("boom");
  });
});
