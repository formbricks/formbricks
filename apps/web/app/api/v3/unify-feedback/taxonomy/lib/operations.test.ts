import { beforeEach, describe, expect, test, vi } from "vitest";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import {
  createTaxonomyRun,
  getActiveTaxonomyTree,
  getTaxonomyRun,
  listTaxonomyFields,
  listTaxonomyNodeRecords,
  listTaxonomyRuns,
  removeTaxonomyNode,
  renameTaxonomyNode,
} from "@/modules/hub/service";
import type { FeedbackRecordData, TaxonomyNode, TaxonomyRun } from "@/modules/hub/types";
import { getSessionUserId, requireUnifyDirectoryAccess } from "./access";
import {
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
  getSessionUserId: vi.fn(),
}));

vi.mock("@/modules/hub/service", () => ({
  listTaxonomyFields: vi.fn(),
  getActiveTaxonomyTree: vi.fn(),
  listTaxonomyRuns: vi.fn(),
  getTaxonomyRun: vi.fn(),
  createTaxonomyRun: vi.fn(),
  listTaxonomyNodeRecords: vi.fn(),
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
  vi.mocked(getSessionUserId).mockReturnValue("user_1");
});

describe("listV3TaxonomyFields", () => {
  test("returns fields with unavailable=false on success", async () => {
    vi.mocked(listTaxonomyFields).mockResolvedValue({ data: { data: [field] }, error: null });

    const response = await listV3TaxonomyFields(base);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { fields: [field], unavailable: false } });
  });

  test("returns 200 with unavailable=true on a Hub error (no false gate)", async () => {
    vi.mocked(listTaxonomyFields).mockResolvedValue({
      data: null,
      error: { status: 503, message: "Embeddings not configured", detail: "" },
    });

    const response = await listV3TaxonomyFields(base);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.unavailable).toBe(true);
    expect(body.data.unavailableMessage).toBe("Embeddings not configured");
    expect(body.data.fields).toEqual([]);
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

  test("returns unavailable=true when the runs call errors", async () => {
    vi.mocked(getActiveTaxonomyTree).mockResolvedValue({
      data: null,
      error: { status: 500, message: "x", detail: "" },
    });
    vi.mocked(listTaxonomyRuns).mockResolvedValue({
      data: null,
      error: { status: 500, message: "boom", detail: "" },
    });

    const response = await getV3TaxonomyState(stateParams);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.unavailable).toBe(true);
  });
});

describe("getV3TaxonomyRun", () => {
  test("returns the run on success", async () => {
    vi.mocked(getTaxonomyRun).mockResolvedValue({ data: run, error: null });

    const response = await getV3TaxonomyRun({ ...base, runId: run.id });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: run });
  });

  test("returns 502 on a Hub error", async () => {
    vi.mocked(getTaxonomyRun).mockResolvedValue({
      data: null,
      error: { status: 500, message: "boom", detail: "" },
    });

    const response = await getV3TaxonomyRun({ ...base, runId: run.id });

    expect(response.status).toBe(502);
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

  test("returns 502 on a Hub error", async () => {
    vi.mocked(listTaxonomyNodeRecords).mockResolvedValue({
      data: null,
      error: { status: 500, message: "boom", detail: "" },
    });

    const response = await getV3TaxonomyNodeRecords({ ...base, nodeId: node.id, limit: 100 });

    expect(response.status).toBe(502);
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
});

describe("renameV3TaxonomyNode", () => {
  test("returns the renamed node on success", async () => {
    const renamed = { ...node, label: "Copilot" };
    vi.mocked(renameTaxonomyNode).mockResolvedValue({ data: renamed, error: null });

    const response = await renameV3TaxonomyNode({ ...base, nodeId: node.id, label: "Copilot" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: renamed });
  });

  test("returns 502 on a Hub error", async () => {
    vi.mocked(renameTaxonomyNode).mockResolvedValue({
      data: null,
      error: { status: 500, message: "boom", detail: "" },
    });

    const response = await renameV3TaxonomyNode({ ...base, nodeId: node.id, label: "Copilot" });

    expect(response.status).toBe(502);
  });
});

describe("removeV3TaxonomyNode", () => {
  test("returns 204 on success", async () => {
    vi.mocked(removeTaxonomyNode).mockResolvedValue({ data: node, error: null });

    const response = await removeV3TaxonomyNode({ ...base, nodeId: node.id });

    expect(response.status).toBe(204);
  });

  test("returns 502 on a Hub error", async () => {
    vi.mocked(removeTaxonomyNode).mockResolvedValue({
      data: null,
      error: { status: 500, message: "boom", detail: "" },
    });

    const response = await removeV3TaxonomyNode({ ...base, nodeId: node.id });

    expect(response.status).toBe(502);
  });
});
