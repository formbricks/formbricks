import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { purgeHubFeedbackRecords } from "@/modules/hub/service";
import { NO_CONFIG_ERROR } from "@/modules/hub/utils";
import { requireFeedbackDatasetMutationAccess } from "./access";
import { purgeV3FeedbackDataset } from "./operations";

vi.mock("server-only", () => ({}));

vi.mock("./access", () => ({
  requireFeedbackDatasetMutationAccess: vi.fn(),
}));

vi.mock("@/modules/hub/service", () => ({
  purgeHubFeedbackRecords: vi.fn(),
}));

const datasetId = "clfd1234567890123456789012";
const context = { organizationId: "org_1" };
const base = {
  authentication: null,
  datasetId,
  requestId: "req_1",
  instance: "/api/internal/feedback-datasets/x/purge",
};

const accepted = { data: { tenantId: datasetId, status: "accepted" }, error: null };

const newAuditLog = (): TV3AuditLog => ({}) as TV3AuditLog;

beforeEach(() => {
  vi.mocked(requireFeedbackDatasetMutationAccess).mockResolvedValue(context);
  vi.mocked(purgeHubFeedbackRecords).mockResolvedValue(accepted);
});

describe("purgeV3FeedbackDataset", () => {
  test("returns 202 with the dataset and status", async () => {
    const response = await purgeV3FeedbackDataset(base);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      data: { datasetId, status: "accepted" },
    });
    expect(purgeHubFeedbackRecords).toHaveBeenCalledWith(datasetId);
  });

  // 202, not 204/200: the Hub purge is a background job, so the records are not gone yet. A 200 with
  // a count would be inventing a number this endpoint never observed.
  test("reports no deleted count", async () => {
    const response = await purgeV3FeedbackDataset(base);
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(body.data).not.toHaveProperty("deletedCount");
    expect(body.data).not.toHaveProperty("deletedFeedbackRecords");
  });

  // The authz gate is the whole security story for this endpoint: a dataset is shared across
  // workspaces, so a workspace member must not be able to destroy records other workspaces read.
  test("purges nothing when authorization fails", async () => {
    const forbidden = new Response("forbidden", { status: 403 });
    vi.mocked(requireFeedbackDatasetMutationAccess).mockResolvedValue(forbidden);

    const response = await purgeV3FeedbackDataset(base);

    expect(response).toBe(forbidden);
    expect(purgeHubFeedbackRecords).not.toHaveBeenCalled();
  });

  test("authorizes the dataset through the org-scoped owner/manager gate", async () => {
    await purgeV3FeedbackDataset(base);

    expect(requireFeedbackDatasetMutationAccess).toHaveBeenCalledWith(
      null,
      datasetId,
      "req_1",
      base.instance
    );
  });

  test("maps an unconfigured Hub to 503", async () => {
    vi.mocked(purgeHubFeedbackRecords).mockResolvedValue({ data: null, error: { ...NO_CONFIG_ERROR } });

    const response = await purgeV3FeedbackDataset(base);

    expect(response.status).toBe(503);
  });

  test("maps a Hub failure to 502", async () => {
    vi.mocked(purgeHubFeedbackRecords).mockResolvedValue({
      data: null,
      error: { status: 500, message: "boom", detail: "boom" },
    });

    const response = await purgeV3FeedbackDataset(base);

    expect(response.status).toBe(502);
  });

  // The SDK folds the whole RFC 9457 body into `message`, so relaying it would leak internal Hub
  // URLs and problem codes into a dashboard response.
  test("never relays the Hub's error text", async () => {
    vi.mocked(purgeHubFeedbackRecords).mockResolvedValue({
      data: null,
      error: { status: 500, message: "http://hub.internal:8080 exploded", detail: "internal detail" },
    });

    const response = await purgeV3FeedbackDataset(base);
    const body = await response.text();

    expect(body).not.toContain("hub.internal");
    expect(body).not.toContain("internal detail");
  });

  test("records the organization and dataset on the audit log", async () => {
    const auditLog = newAuditLog();

    await purgeV3FeedbackDataset({ ...base, auditLog });

    expect(auditLog.organizationId).toBe("org_1");
    expect(auditLog.targetId).toBe(datasetId);
    expect(auditLog.newObject).toEqual({ purgeRequested: true });
  });

  // A failed purge must not leave an audit entry claiming one happened.
  test("does not record a purge that was never accepted", async () => {
    const auditLog = newAuditLog();
    vi.mocked(purgeHubFeedbackRecords).mockResolvedValue({
      data: null,
      error: { status: 500, message: "boom", detail: "boom" },
    });

    await purgeV3FeedbackDataset({ ...base, auditLog });

    expect(auditLog.newObject).toBeUndefined();
    // The target is still recorded, so a failed attempt is attributable.
    expect(auditLog.targetId).toBe(datasetId);
  });
});
