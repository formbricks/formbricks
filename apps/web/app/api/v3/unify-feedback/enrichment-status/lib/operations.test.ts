import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireUnifyFeedbackWorkspaceAccess } from "@/app/api/v3/lib/feedback-access";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import type { TEnrichmentStatusResponse } from "@/modules/ee/unify-feedback/enrichment-status/lib/enrichment";
import { getEnrichmentStatus } from "@/modules/hub/service";
import type { EnrichmentStatusResponse } from "@/modules/hub/types";
import { NO_CONFIG_ERROR } from "@/modules/hub/utils";
import { getV3EnrichmentStatus } from "./operations";

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/v3/lib/feedback-access", () => ({
  requireUnifyFeedbackWorkspaceAccess: vi.fn(),
}));

vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: vi.fn(),
}));

vi.mock("@/modules/hub/service", () => ({
  getEnrichmentStatus: vi.fn(),
}));

const workspaceId = "clxx1234567890123456789012";
const context: V3WorkspaceContext = { workspaceId, organizationId: "org_1" };
const base = { authentication: null, workspaceId, requestId: "req_1", instance: "/x" };

const hubStatus = (tenantId: string, done: number): EnrichmentStatusResponse => ({
  tenant_id: tenantId,
  translation: { enabled: true, eligible: 100, done },
  sentiment: { enabled: false, eligible: 0, done: 0 },
  emotions: { enabled: false, eligible: 0, done: 0 },
});

const readBody = async (response: Response): Promise<TEnrichmentStatusResponse> =>
  ((await response.json()) as { data: TEnrichmentStatusResponse }).data;

describe("getV3EnrichmentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUnifyFeedbackWorkspaceAccess).mockResolvedValue(context);
  });

  test("short-circuits on the authorization response without reaching the Hub", async () => {
    const forbidden = new Response(null, { status: 403 });
    vi.mocked(requireUnifyFeedbackWorkspaceAccess).mockResolvedValue(forbidden);

    const response = await getV3EnrichmentStatus(base);

    expect(response).toBe(forbidden);
    expect(getFeedbackDirectoriesByWorkspaceId).not.toHaveBeenCalled();
    expect(getEnrichmentStatus).not.toHaveBeenCalled();
  });

  test("resolves the tenant ids from the workspace's own directories", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([
      { id: "frd-1" },
      { id: "frd-2" },
    ] as Awaited<ReturnType<typeof getFeedbackDirectoriesByWorkspaceId>>);
    vi.mocked(getEnrichmentStatus).mockImplementation(async (tenantId: string) => ({
      data: hubStatus(tenantId, 40),
      error: null,
    }));

    const response = await getV3EnrichmentStatus(base);

    expect(getFeedbackDirectoriesByWorkspaceId).toHaveBeenCalledWith(workspaceId);
    expect(getEnrichmentStatus).toHaveBeenCalledWith("frd-1");
    expect(getEnrichmentStatus).toHaveBeenCalledWith("frd-2");
    await expect(readBody(response)).resolves.toEqual({
      enrichments: [{ kind: "translation", eligible: 200, done: 80, failedTerminal: 0, pending: 120 }],
      unavailable: false,
    });
  });

  test("reports no enrichments when the workspace has no directory", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([]);

    const response = await getV3EnrichmentStatus(base);

    expect(getEnrichmentStatus).not.toHaveBeenCalled();
    await expect(readBody(response)).resolves.toEqual({ enrichments: [], unavailable: false });
  });

  test("degrades to unavailable rather than erroring when every directory fails", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([{ id: "frd-1" }] as Awaited<
      ReturnType<typeof getFeedbackDirectoriesByWorkspaceId>
    >);
    vi.mocked(getEnrichmentStatus).mockResolvedValue({ data: null, error: { ...NO_CONFIG_ERROR } });

    const response = await getV3EnrichmentStatus(base);

    expect(response.status).toBe(200);
    await expect(readBody(response)).resolves.toEqual({ enrichments: [], unavailable: true });
  });

  test("keeps the directories that answered when one of them fails", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([
      { id: "frd-1" },
      { id: "frd-2" },
    ] as Awaited<ReturnType<typeof getFeedbackDirectoriesByWorkspaceId>>);
    vi.mocked(getEnrichmentStatus).mockImplementation(async (tenantId: string) =>
      tenantId === "frd-1"
        ? { data: hubStatus(tenantId, 25), error: null }
        : { data: null, error: { ...NO_CONFIG_ERROR } }
    );

    const response = await getV3EnrichmentStatus(base);

    // The failed directory is left out entirely — counting it as zero-done would invent a backlog.
    await expect(readBody(response)).resolves.toEqual({
      enrichments: [{ kind: "translation", eligible: 100, done: 25, failedTerminal: 0, pending: 75 }],
      unavailable: false,
    });
  });
});
