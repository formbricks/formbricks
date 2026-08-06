import { beforeEach, describe, expect, test, vi } from "vitest";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import {
  createTaxonomyRun,
  getActiveTaxonomyTree,
  getTaxonomyRun,
  listTaxonomyFields,
  listTaxonomyNodeRecordCounts,
  listTaxonomyNodeRecords,
  listTaxonomyRuns,
  removeTaxonomyNode,
  renameTaxonomyNode,
} from "@/modules/hub/service";
import type { FeedbackRecordData, TaxonomyNode, TaxonomyRun } from "@/modules/hub/types";
import { NO_CONFIG_ERROR } from "@/modules/hub/utils";
import { getSessionUserId, requireUnifyDirectoryAccess, requireUnifyDirectoryMutationAccess } from "./access";
import {
  getV3TaxonomyNodeRecordCounts,
  getV3TaxonomyNodeRecords,
  getV3TaxonomyRun,
  getV3TaxonomyState,
  listV3TaxonomyFields,
  removeV3TaxonomyNode,
  renameV3TaxonomyNode,
  triggerV3TaxonomyRun,
} from "./operations";

vi.mock("server-only", () => ({}));

vi.mock("./access", () => ({
  requireUnifyDirectoryAccess: vi.fn(),
  requireUnifyDirectoryMutationAccess: vi.fn(),
  getSessionUserId: vi.fn(),
}));

vi.mock("@/modules/hub/service", () => ({
  listTaxonomyFields: vi.fn(),
  getActiveTaxonomyTree: vi.fn(),
  listTaxonomyRuns: vi.fn(),
  getTaxonomyRun: vi.fn(),
  createTaxonomyRun: vi.fn(),
  listTaxonomyNodeRecords: vi.fn(),
  listTaxonomyNodeRecordCounts: vi.fn(),
  renameTaxonomyNode: vi.fn(),
  removeTaxonomyNode: vi.fn(),
}));

const workspaceId = "clxx1234567890123456789012";
const directoryId = "clfd1234567890123456789012";
const context: V3WorkspaceContext = { workspaceId, organizationId: "org_1" };
const base = { authentication: null, workspaceId, directoryId, requestId: "req_1", instance: "/x" };

const field = {
  tenant_id: directoryId,
  source_type: "survey",
  source_id: "s1",
  field_id: "q1",
  record_count: 800,
  embedding_count: 800,
};

const run: TaxonomyRun = {
  id: "run-uuid",
  tenant_id: directoryId,
  source_type: "survey",
  source_id: "s1",
  field_id: "q1",
  status: "succeeded",
  record_count: 800,
  embedding_count: 800,
  cluster_count: 5,
  node_count: 10,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

const node: TaxonomyNode = {
  id: "node-uuid",
  run_id: run.id,
  node_type: "branch",
  label: "AI Assistant",
  level: 1,
  sort_order: 0,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

/**
 * Hub failures, shaped the way the SDK actually produces them: it has no `message` field to read off an
 * RFC 9457 body, so it stringifies the whole body — internal problem URLs included — into `message`.
 * Nothing built from these may reach the response, which is what the `toContain` guards below check.
 */
const HUB_INTERNAL_MARKER = "hub.formbricks.com/problems";
const hubNotFound = {
  status: 404,
  message: `404 {"type":"https://${HUB_INTERNAL_MARKER}/not-found","title":"Not Found"}`,
  detail: "",
};
const hubServerError = {
  status: 500,
  message: `500 {"type":"https://${HUB_INTERNAL_MARKER}/internal","title":"Internal Server Error"}`,
  detail: "",
};

const record: FeedbackRecordData = {
  id: "rec-1",
  collected_at: "2026-07-01T00:00:00.000Z",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  field_id: "q1",
  field_type: "text",
  source_type: "survey",
  submission_id: "sub-1",
  tenant_id: directoryId,
  value_text: "Love the assistant",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireUnifyDirectoryAccess).mockResolvedValue(context);
  vi.mocked(requireUnifyDirectoryMutationAccess).mockResolvedValue(context);
  vi.mocked(getSessionUserId).mockReturnValue("user_1");
});

describe("listV3TaxonomyFields", () => {
  test("returns fields with unavailable=false on success", async () => {
    vi.mocked(listTaxonomyFields).mockResolvedValue({ data: { data: [field] }, error: null });

    const response = await listV3TaxonomyFields(base);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { fields: [field], unavailable: false } });
  });

  test("returns 200 with a bare unavailable=true on a Hub error (no false gate, no Hub text)", async () => {
    vi.mocked(listTaxonomyFields).mockResolvedValue({ data: null, error: hubServerError });

    const response = await listV3TaxonomyFields(base);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ fields: [], unavailable: true });
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });

  test("returns the auth Response and skips the Hub call when access is denied", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireUnifyDirectoryAccess).mockResolvedValue(denied);

    const response = await listV3TaxonomyFields(base);

    expect(response).toBe(denied);
    expect(listTaxonomyFields).not.toHaveBeenCalled();
  });
});

describe("getV3TaxonomyState", () => {
  const stateParams = {
    ...base,
    scopeType: "field" as const,
    sourceType: "survey",
    sourceId: "s1",
    fieldId: "q1",
  };

  test("returns the active tree + runs on success", async () => {
    vi.mocked(getActiveTaxonomyTree).mockResolvedValue({ data: { run, root: node }, error: null });
    vi.mocked(listTaxonomyRuns).mockResolvedValue({ data: { data: [run] }, error: null });

    const response = await getV3TaxonomyState(stateParams);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.activeTree).toEqual({ run, root: node });
    expect(body.data.runs).toEqual([run]);
    expect(body.data.unavailable).toBe(false);
  });

  test("treats a 404 active tree as 'no taxonomy yet' (activeTree null, not unavailable)", async () => {
    vi.mocked(getActiveTaxonomyTree).mockResolvedValue({
      data: null,
      error: { status: 404, message: "no active tree", detail: "" },
    });
    vi.mocked(listTaxonomyRuns).mockResolvedValue({ data: { data: [] }, error: null });

    const response = await getV3TaxonomyState(stateParams);
    const body = await response.json();

    expect(body.data.activeTree).toBeNull();
    expect(body.data.unavailable).toBe(false);
  });

  test("returns a bare unavailable=true when the runs call errors, without the Hub's own text", async () => {
    vi.mocked(getActiveTaxonomyTree).mockResolvedValue({ data: null, error: hubServerError });
    vi.mocked(listTaxonomyRuns).mockResolvedValue({ data: null, error: hubServerError });

    const response = await getV3TaxonomyState(stateParams);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ activeTree: null, runs: [], unavailable: true });
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });

  test("flags a tree outage without the Hub's own text when only the tree call errors", async () => {
    vi.mocked(getActiveTaxonomyTree).mockResolvedValue({ data: null, error: hubServerError });
    vi.mocked(listTaxonomyRuns).mockResolvedValue({ data: { data: [run] }, error: null });

    const response = await getV3TaxonomyState(stateParams);
    const body = await response.json();

    expect(body.data).toEqual({ activeTree: null, runs: [run], unavailable: true });
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });
});

describe("getV3TaxonomyRun", () => {
  test("returns the run on success", async () => {
    vi.mocked(getTaxonomyRun).mockResolvedValue({ data: run, error: null });

    const response = await getV3TaxonomyRun({ ...base, runId: run.id });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: run });
  });

  test("returns 404, not 502, when the Hub does not have the run", async () => {
    vi.mocked(getTaxonomyRun).mockResolvedValue({ data: null, error: hubNotFound });

    const response = await getV3TaxonomyRun({ ...base, runId: run.id });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("not_found");
    expect(body.detail).toBe("Taxonomy run not found");
    expect(body.details).toEqual({ resource_type: "Taxonomy run", resource_id: run.id });
    // Only the id the caller already sent — no run payload, and none of the Hub's own error text.
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
    expect(JSON.stringify(body)).not.toContain(run.tenant_id);
  });

  test("returns 502 with a sanitized detail on a Hub 5xx", async () => {
    vi.mocked(getTaxonomyRun).mockResolvedValue({ data: null, error: hubServerError });

    const response = await getV3TaxonomyRun({ ...base, runId: run.id });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.detail).toBe("Failed to load taxonomy run");
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });

  test("returns 502 on a connection failure, which has no status", async () => {
    vi.mocked(getTaxonomyRun).mockResolvedValue({
      data: null,
      error: { status: 0, message: "Connection error.", detail: "Connection error." },
    });

    const response = await getV3TaxonomyRun({ ...base, runId: run.id });

    expect(response.status).toBe(502);
  });

  test("returns 503 when the Hub integration is not configured", async () => {
    vi.mocked(getTaxonomyRun).mockResolvedValue({ data: null, error: { ...NO_CONFIG_ERROR } });

    const response = await getV3TaxonomyRun({ ...base, runId: run.id });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe("service_unavailable");
    // The sentinel names the env var; the response must not.
    expect(body.detail).not.toContain("HUB_API_KEY");
  });

  test("returns 502 when the Hub reports success but no payload", async () => {
    vi.mocked(getTaxonomyRun).mockResolvedValue({ data: null, error: null });

    const response = await getV3TaxonomyRun({ ...base, runId: run.id });

    expect(response.status).toBe(502);
  });
});

describe("getV3TaxonomyNodeRecordCounts", () => {
  test("returns the per-node counts on success", async () => {
    const counts = [{ node_id: node.id, record_count: 12 }];
    vi.mocked(listTaxonomyNodeRecordCounts).mockResolvedValue({ data: { counts }, error: null });

    const response = await getV3TaxonomyNodeRecordCounts({ ...base, runId: run.id });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { counts } });
  });

  test("returns 404, not 502, when the Hub does not have the run", async () => {
    vi.mocked(listTaxonomyNodeRecordCounts).mockResolvedValue({ data: null, error: hubNotFound });

    const response = await getV3TaxonomyNodeRecordCounts({ ...base, runId: run.id });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.details).toEqual({ resource_type: "Taxonomy run", resource_id: run.id });
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });

  test("returns 502 with a sanitized detail on a Hub 5xx", async () => {
    vi.mocked(listTaxonomyNodeRecordCounts).mockResolvedValue({ data: null, error: hubServerError });

    const response = await getV3TaxonomyNodeRecordCounts({ ...base, runId: run.id });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.detail).toBe("Failed to load record counts");
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });
});

describe("getV3TaxonomyNodeRecords", () => {
  test("returns the record sample with the applied limit in meta", async () => {
    vi.mocked(listTaxonomyNodeRecords).mockResolvedValue({
      data: { data: [record], limit: 100 },
      error: null,
    });

    const response = await getV3TaxonomyNodeRecords({ ...base, nodeId: node.id, limit: 100 });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([record]);
    expect(body.meta).toEqual({ limit: 100 });
  });

  test("returns 404, not 502, when the Hub does not have the node", async () => {
    vi.mocked(listTaxonomyNodeRecords).mockResolvedValue({ data: null, error: hubNotFound });

    const response = await getV3TaxonomyNodeRecords({ ...base, nodeId: node.id, limit: 100 });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.details).toEqual({ resource_type: "Taxonomy node", resource_id: node.id });
    // No record sample leaks onto the not-found path.
    expect(body).not.toHaveProperty("data");
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });

  test("returns 502 with a sanitized detail on a Hub 5xx", async () => {
    vi.mocked(listTaxonomyNodeRecords).mockResolvedValue({ data: null, error: hubServerError });

    const response = await getV3TaxonomyNodeRecords({ ...base, nodeId: node.id, limit: 100 });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.detail).toBe("Failed to load feedback records");
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });
});

describe("triggerV3TaxonomyRun", () => {
  const runParams = {
    ...base,
    scopeType: "field" as const,
    sourceType: "survey",
    sourceId: "s1",
    fieldId: "q1",
  };

  test("starts a run and returns { run, inProgress }", async () => {
    vi.mocked(createTaxonomyRun).mockResolvedValue({ data: { run, in_progress: false }, error: null });

    const response = await triggerV3TaxonomyRun(runParams);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { run, inProgress: false } });
    expect(createTaxonomyRun).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: directoryId,
        scope_type: "field",
        source_type: "survey",
        field_id: "q1",
        actor_id: "user_1",
      })
    );
  });

  test("directory scope starts a run with scope_type=directory and no source/field", async () => {
    vi.mocked(createTaxonomyRun).mockResolvedValue({ data: { run, in_progress: false }, error: null });

    const response = await triggerV3TaxonomyRun({ ...base, scopeType: "directory" });

    expect(response.status).toBe(200);
    expect(createTaxonomyRun).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: directoryId, scope_type: "directory", actor_id: "user_1" })
    );
    const arg = vi.mocked(createTaxonomyRun).mock.calls.at(-1)?.[0];
    expect(arg).not.toHaveProperty("source_type");
    expect(arg).not.toHaveProperty("field_id");
  });

  test("returns 401 when there is no session user", async () => {
    vi.mocked(getSessionUserId).mockReturnValue(null);

    const response = await triggerV3TaxonomyRun(runParams);

    expect(response.status).toBe(401);
    expect(createTaxonomyRun).not.toHaveBeenCalled();
  });

  test("gates on the owners/managers check and skips the Hub call when denied (ENG-1770)", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireUnifyDirectoryMutationAccess).mockResolvedValue(denied);

    const response = await triggerV3TaxonomyRun(runParams);

    expect(response).toBe(denied);
    expect(requireUnifyDirectoryAccess).not.toHaveBeenCalled();
    expect(createTaxonomyRun).not.toHaveBeenCalled();
  });

  test("keeps a Hub 404 as a 502 — there is no resource to report missing on a create", async () => {
    vi.mocked(createTaxonomyRun).mockResolvedValue({ data: null, error: hubNotFound });

    const response = await triggerV3TaxonomyRun(runParams);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.detail).toBe("Failed to start taxonomy generation");
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });

  test("returns 502 with a sanitized detail on a Hub 5xx", async () => {
    vi.mocked(createTaxonomyRun).mockResolvedValue({ data: null, error: hubServerError });

    const response = await triggerV3TaxonomyRun(runParams);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.detail).toBe("Failed to start taxonomy generation");
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });
});

describe("renameV3TaxonomyNode", () => {
  test("returns the renamed node on success", async () => {
    const renamed = { ...node, label: "Copilot" };
    vi.mocked(renameTaxonomyNode).mockResolvedValue({ data: renamed, error: null });

    const response = await renameV3TaxonomyNode({ ...base, nodeId: node.id, label: "Copilot" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: renamed });
  });

  test("returns 404, not 502, when the node was already removed", async () => {
    vi.mocked(renameTaxonomyNode).mockResolvedValue({ data: null, error: hubNotFound });

    const response = await renameV3TaxonomyNode({ ...base, nodeId: node.id, label: "Copilot" });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.details).toEqual({ resource_type: "Taxonomy node", resource_id: node.id });
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });

  test("returns 502 with a sanitized detail on a Hub 5xx", async () => {
    vi.mocked(renameTaxonomyNode).mockResolvedValue({ data: null, error: hubServerError });

    const response = await renameV3TaxonomyNode({ ...base, nodeId: node.id, label: "Copilot" });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.detail).toBe("Failed to rename taxonomy node");
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });

  test("gates on the owners/managers check and skips the Hub call when denied (ENG-1770)", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireUnifyDirectoryMutationAccess).mockResolvedValue(denied);

    const response = await renameV3TaxonomyNode({ ...base, nodeId: node.id, label: "Copilot" });

    expect(response).toBe(denied);
    expect(requireUnifyDirectoryAccess).not.toHaveBeenCalled();
    expect(renameTaxonomyNode).not.toHaveBeenCalled();
  });
});

describe("removeV3TaxonomyNode", () => {
  test("returns 204 on success", async () => {
    vi.mocked(removeTaxonomyNode).mockResolvedValue({ data: node, error: null });

    const response = await removeV3TaxonomyNode({ ...base, nodeId: node.id });

    expect(response.status).toBe(204);
  });

  test("returns 404, not 502, when the node was already removed", async () => {
    vi.mocked(removeTaxonomyNode).mockResolvedValue({ data: null, error: hubNotFound });

    const response = await removeV3TaxonomyNode({ ...base, nodeId: node.id });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.details).toEqual({ resource_type: "Taxonomy node", resource_id: node.id });
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });

  test("returns 502 with a sanitized detail on a Hub 5xx", async () => {
    vi.mocked(removeTaxonomyNode).mockResolvedValue({ data: null, error: hubServerError });

    const response = await removeV3TaxonomyNode({ ...base, nodeId: node.id });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.detail).toBe("Failed to remove taxonomy node");
    expect(JSON.stringify(body)).not.toContain(HUB_INTERNAL_MARKER);
  });

  test("gates on the owners/managers check and skips the Hub call when denied (ENG-1770)", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireUnifyDirectoryMutationAccess).mockResolvedValue(denied);

    const response = await removeV3TaxonomyNode({ ...base, nodeId: node.id });

    expect(response).toBe(denied);
    expect(requireUnifyDirectoryAccess).not.toHaveBeenCalled();
    expect(removeTaxonomyNode).not.toHaveBeenCalled();
  });
});
