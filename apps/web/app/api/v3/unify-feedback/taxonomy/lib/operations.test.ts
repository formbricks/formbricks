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
import { getSessionUserId, requireUnifyDirectoryAccess } from "./access";
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

const logWarn = vi.fn();
const logError = vi.fn();
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: logWarn, error: logError })) },
}));

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
  listTaxonomyNodeRecordCounts: vi.fn(),
  renameTaxonomyNode: vi.fn(),
  removeTaxonomyNode: vi.fn(),
}));

/**
 * A Hub 4xx `detail` the shared mapper is allowed to echo back. This is the Hub's real wording: on a
 * validation failure it keeps `detail` fixed and puts the actionable message in `invalid_params`.
 */
const RELAYABLE_HUB_DETAIL = "One or more request parameters are invalid";

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

  test("returns 200 with unavailable=true on a Hub error (no false gate), without echoing Hub text", async () => {
    vi.mocked(listTaxonomyFields).mockResolvedValue({
      data: null,
      error: { status: 503, message: "HUB_API_KEY is not set; Hub integration is disabled.", detail: "" },
    });

    const response = await listV3TaxonomyFields(base);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.unavailable).toBe(true);
    expect(body.data.unavailableMessage).toBe("Taxonomy fields are unavailable");
    expect(JSON.stringify(body)).not.toContain("HUB_API_KEY");
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

  test("maps a Hub 404 to 404 with no resource id, so the client can stop polling", async () => {
    vi.mocked(getTaxonomyRun).mockResolvedValue({
      data: null,
      error: { status: 404, message: "run not found", detail: "", code: "not_found" },
    });

    const response = await getV3TaxonomyRun({ ...base, runId: run.id });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("not_found");
    expect(body.details).toEqual({ resource_type: "Taxonomy run", resource_id: null });
    expect(JSON.stringify(body)).not.toContain(run.id);
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

  test("returns a fixed-detail 502 on a Hub 500, without the upstream message", async () => {
    vi.mocked(listTaxonomyNodeRecords).mockResolvedValue({
      data: null,
      error: { status: 500, message: "pq: relation \"taxonomy_nodes\" does not exist", detail: "" },
    });

    const response = await getV3TaxonomyNodeRecords({ ...base, nodeId: node.id, limit: 100 });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.detail).toBe("The feedback service is unavailable.");
    expect(JSON.stringify(body)).not.toContain("taxonomy_nodes");
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

  test("returns a fixed-detail 502 on a Hub 500, without the upstream message", async () => {
    vi.mocked(renameTaxonomyNode).mockResolvedValue({
      data: null,
      error: { status: 500, message: "pq: relation \"taxonomy_nodes\" does not exist", detail: "" },
    });

    const response = await renameV3TaxonomyNode({ ...base, nodeId: node.id, label: "Copilot" });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.detail).toBe("The feedback service is unavailable.");
    expect(JSON.stringify(body)).not.toContain("taxonomy_nodes");
  });
});

describe("removeV3TaxonomyNode", () => {
  test("returns 204 on success", async () => {
    vi.mocked(removeTaxonomyNode).mockResolvedValue({ data: node, error: null });

    const response = await removeV3TaxonomyNode({ ...base, nodeId: node.id });

    expect(response.status).toBe(204);
  });

  test("returns a fixed-detail 502 on a Hub 500, without the upstream message", async () => {
    vi.mocked(removeTaxonomyNode).mockResolvedValue({
      data: null,
      error: { status: 500, message: "pq: relation \"taxonomy_nodes\" does not exist", detail: "" },
    });

    const response = await removeV3TaxonomyNode({ ...base, nodeId: node.id });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.detail).toBe("The feedback service is unavailable.");
    expect(JSON.stringify(body)).not.toContain("taxonomy_nodes");
  });
});

describe("getV3TaxonomyNodeRecordCounts", () => {
  const counts = [
    { node_id: node.id, record_count: 42 },
    { node_id: "node-2", record_count: 7 },
  ];

  test("returns the per-node counts on success", async () => {
    vi.mocked(listTaxonomyNodeRecordCounts).mockResolvedValue({ data: { counts }, error: null });

    const response = await getV3TaxonomyNodeRecordCounts({ ...base, runId: run.id });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { counts } });
    expect(listTaxonomyNodeRecordCounts).toHaveBeenCalledWith(run.id, directoryId);
  });

  test("returns the auth Response and skips the Hub call when access is denied", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireUnifyDirectoryAccess).mockResolvedValue(denied);

    const response = await getV3TaxonomyNodeRecordCounts({ ...base, runId: run.id });

    expect(response).toBe(denied);
    expect(listTaxonomyNodeRecordCounts).not.toHaveBeenCalled();
  });

  /**
   * One table over every Hub status these endpoints can actually produce. The Hub has no 429/413/422 path
   * for taxonomy, so those shared-mapper branches stay untested here on purpose. `detail` is asserted
   * because it is the field this change alters — status alone would pass against the old code too.
   */
  test.each([
    { hub: 0, status: 502, code: "bad_gateway", detail: "The feedback service is unavailable." },
    { hub: 400, status: 400, code: "bad_request", detail: RELAYABLE_HUB_DETAIL },
    { hub: 401, status: 502, code: "bad_gateway", detail: "The feedback service is unavailable." },
    { hub: 404, status: 404, code: "not_found", detail: "Taxonomy run not found" },
    { hub: 409, status: 409, code: "conflict", detail: RELAYABLE_HUB_DETAIL },
    { hub: 500, status: 502, code: "bad_gateway", detail: "The feedback service is unavailable." },
    { hub: 503, status: 503, code: "service_unavailable", detail: undefined },
  ])("maps Hub $hub to $status", async ({ hub, status, code, detail }) => {
    vi.mocked(listTaxonomyNodeRecordCounts).mockResolvedValue({
      data: null,
      error: {
        status: hub,
        message: "GET http://hub.internal:8080/v1/taxonomy/runs failed: upstream boom",
        detail: "",
        // Same fixture on every row, so a status that must *not* relay is caught by the expected
        // `detail` below rather than by the fixture simply being absent.
        problemDetail: RELAYABLE_HUB_DETAIL,
      },
    });

    const response = await getV3TaxonomyNodeRecordCounts({ ...base, runId: run.id });
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(body.code).toBe(code);
    if (detail !== undefined) {
      expect(body.detail).toBe(detail);
    }
    // Whatever the mapping, the SDK's own error string never reaches the caller.
    expect(JSON.stringify(body)).not.toContain("hub.internal");
    expect(JSON.stringify(body)).not.toContain("upstream boom");
  });

  test("a 503 names the taxonomy subsystems, not embeddings", async () => {
    vi.mocked(listTaxonomyNodeRecordCounts).mockResolvedValue({
      data: null,
      error: { status: 503, message: "embeddings not configured", detail: "" },
    });

    const response = await getV3TaxonomyNodeRecordCounts({ ...base, runId: run.id });
    const body = await response.json();

    expect(response.status).toBe(503);
    // A taxonomy 503 has four upstream causes and only one is embeddings — and that one is unreachable
    // through the UI, since /fields gates the button first. Pointing this at feedbackRecords'
    // embeddings-specific copy would therefore be wrong in exactly the case a user can hit.
    expect(body.detail).not.toBe("Embeddings are not configured for this deployment.");
    expect(body.detail).toContain("taxonomy");
    expect(body.detail).toContain("retry");
  });
});

describe("Hub error disclosure", () => {
  const leaky = {
    status: 500,
    message:
      'HUB_API_KEY is not set; GET http://hub.internal:8080/v1/taxonomy/runs/x?tenant_id=y -> 500 (request_id: hub_req_9f3) at /app/internal/service/taxonomy_service.go:196',
    detail: "pq: relation \"taxonomy_nodes\" does not exist",
    problemDetail: "internal: /app/internal/service/taxonomy_service.go:196",
  };
  const markers = [
    "HUB_API_KEY",
    "hub.internal",
    "hub_req_9f3",
    "taxonomy_service.go",
    "taxonomy_nodes",
    "/app/internal",
  ];

  /**
   * The invariant this whole change exists for: no upstream text on the wire, whichever endpoint failed.
   * Planted markers rather than a reading of the code, so a future call site that forgets the mapper fails
   * here instead of shipping.
   */
  test.each([
    {
      name: "listV3TaxonomyFields",
      arrange: () => vi.mocked(listTaxonomyFields).mockResolvedValue({ data: null, error: leaky }),
      act: () => listV3TaxonomyFields(base),
    },
    {
      name: "getV3TaxonomyState",
      arrange: () => {
        vi.mocked(listTaxonomyRuns).mockResolvedValue({ data: null, error: leaky });
        vi.mocked(getActiveTaxonomyTree).mockResolvedValue({ data: null, error: leaky });
      },
      act: () => getV3TaxonomyState({ ...base, scopeType: "directory" as const }),
    },
    {
      name: "getV3TaxonomyRun",
      arrange: () => vi.mocked(getTaxonomyRun).mockResolvedValue({ data: null, error: leaky }),
      act: () => getV3TaxonomyRun({ ...base, runId: run.id }),
    },
    {
      name: "getV3TaxonomyNodeRecordCounts",
      arrange: () =>
        vi.mocked(listTaxonomyNodeRecordCounts).mockResolvedValue({ data: null, error: leaky }),
      act: () => getV3TaxonomyNodeRecordCounts({ ...base, runId: run.id }),
    },
    {
      name: "triggerV3TaxonomyRun",
      arrange: () => vi.mocked(createTaxonomyRun).mockResolvedValue({ data: null, error: leaky }),
      act: () =>
        triggerV3TaxonomyRun({
          ...base,
          scopeType: "field" as const,
          sourceType: "survey",
          sourceId: "s1",
          fieldId: "q1",
        }),
    },
    {
      name: "getV3TaxonomyNodeRecords",
      arrange: () => vi.mocked(listTaxonomyNodeRecords).mockResolvedValue({ data: null, error: leaky }),
      act: () => getV3TaxonomyNodeRecords({ ...base, nodeId: node.id, limit: 100 }),
    },
    {
      name: "renameV3TaxonomyNode",
      arrange: () => vi.mocked(renameTaxonomyNode).mockResolvedValue({ data: null, error: leaky }),
      act: () => renameV3TaxonomyNode({ ...base, nodeId: node.id, label: "Copilot" }),
    },
    {
      name: "removeV3TaxonomyNode",
      arrange: () => vi.mocked(removeTaxonomyNode).mockResolvedValue({ data: null, error: leaky }),
      act: () => removeV3TaxonomyNode({ ...base, nodeId: node.id }),
    },
  ])("$name returns no upstream internals", async ({ arrange, act }) => {
    arrange();

    const serialised = await (await act()).text();

    for (const marker of markers) {
      expect(serialised).not.toContain(marker);
    }
  });
});

describe("triggerV3TaxonomyRun error branch", () => {
  const runParams = {
    ...base,
    scopeType: "directory" as const,
  };

  /**
   * The Hub's real 400 body, taken from a live response: `detail` is a fixed "one or more parameters are
   * invalid" string and the *actionable* message sits in `invalid_params[0].reason`. Relaying `detail`
   * alone would therefore drop the only text that tells a user why the run was refused.
   */
  test("keeps a Hub 400's actionable reason, which lives in invalid_params and not in detail", async () => {
    const reason = "at least 750 embedded text feedback records are required; found 12";
    // `TaxonomyScope.tenant_id` in the Hub's wording — the shared mapper rewrites the internal term to the
    // product's own ("dataset") for every surface, so this asserts the rewritten name.
    vi.mocked(createTaxonomyRun).mockResolvedValue({
      data: null,
      error: {
        status: 400,
        message: "bad request",
        detail: "",
        code: "validation",
        problemDetail: RELAYABLE_HUB_DETAIL,
        invalidParams: [{ name: "TaxonomyScope.tenant_id", reason }],
      },
    });

    const response = await triggerV3TaxonomyRun(runParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.detail).toBe(RELAYABLE_HUB_DETAIL);
    expect(body.invalid_params).toEqual([{ name: "TaxonomyScope.dataset_id", reason }]);
    // The Hub's own `code` vocabulary ("validation") does not cross over into ours.
    expect(body.code).toBe("bad_request");
  });

  test("maps the Hub's 'no config' error (status 0) to a fixed 502", async () => {
    vi.mocked(createTaxonomyRun).mockResolvedValue({
      data: null,
      error: { ...NO_CONFIG_ERROR },
    });

    const response = await triggerV3TaxonomyRun(runParams);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.detail).toBe("The feedback service is unavailable.");
    expect(JSON.stringify(body)).not.toContain("HUB_API_KEY");
  });
});

describe("Hub failure logging", () => {
  /**
   * The other half of the disclosure rule: the upstream diagnostic still has to exist, just server-side.
   * Removing it from the response without logging it would make these failures undebuggable.
   */
  test("logs a 5xx at error level, with the Hub error under the serialised `err` key", async () => {
    const error = { status: 500, message: "upstream boom", detail: "" };
    vi.mocked(getTaxonomyRun).mockResolvedValue({ data: null, error });

    await getV3TaxonomyRun({ ...base, runId: run.id });

    expect(logError).toHaveBeenCalledWith(
      { hubStatus: 500, hubCode: undefined, err: error },
      "Hub getRun failed"
    );
    expect(logWarn).not.toHaveBeenCalled();
  });

  test("logs a 4xx at warn level and without a stack, since it is not our fault", async () => {
    vi.mocked(createTaxonomyRun).mockResolvedValue({
      data: null,
      error: { status: 400, message: "too few records", detail: "", code: "bad_request" },
    });

    await triggerV3TaxonomyRun({ ...base, scopeType: "directory" as const });

    expect(logWarn).toHaveBeenCalledWith({ hubStatus: 400, hubCode: "bad_request" }, "Hub rejected startRun");
    expect(logError).not.toHaveBeenCalled();
  });

  test("logs a Hub 401 loudly — it is our credentials, not the caller's request", async () => {
    const error = { status: 401, message: "invalid api key", detail: "" };
    vi.mocked(getTaxonomyRun).mockResolvedValue({ data: null, error });

    const response = await getV3TaxonomyRun({ ...base, runId: run.id });

    // The caller gets an opaque 502, so the log is the only place this is explainable.
    expect(response.status).toBe(502);
    expect(logError).toHaveBeenCalledWith(
      { hubStatus: 401, hubCode: undefined, err: error },
      "Hub getRun failed"
    );
    expect(logWarn).not.toHaveBeenCalled();
  });

  test("logs the 200-with-unavailable paths too, where the response says nothing at all", async () => {
    vi.mocked(listTaxonomyFields).mockResolvedValue({
      data: null,
      error: { status: 0, message: "HUB_API_KEY is not set; Hub integration is disabled.", detail: "" },
    });

    await listV3TaxonomyFields(base);

    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ hubStatus: 0 }),
      "Hub listFields failed"
    );
  });
});
