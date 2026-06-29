import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import {
  getTaxonomyFieldsAction,
  getTaxonomyNodeRecordsAction,
  getTaxonomyRunAction,
  getTaxonomyStateAction,
  getTaxonomyTreeAction,
  removeTaxonomyNodeAction,
  renameTaxonomyNodeAction,
  triggerTaxonomyRunAction,
} from "./actions";

const mocks = vi.hoisted(() => ({
  checkAuthorizationUpdated: vi.fn(),
  createTaxonomyRun: vi.fn(),
  getActiveTaxonomyTree: vi.fn(),
  getFeedbackDirectoriesByWorkspaceId: vi.fn(),
  getIsFeedbackDirectoriesEnabled: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getTaxonomyRun: vi.fn(),
  getTaxonomyTree: vi.fn(),
  listTaxonomyFields: vi.fn(),
  listTaxonomyNodeRecords: vi.fn(),
  listTaxonomyRuns: vi.fn(),
  removeTaxonomyNode: vi.fn(),
  renameTaxonomyNode: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
  },
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));

vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: mocks.getFeedbackDirectoriesByWorkspaceId,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsFeedbackDirectoriesEnabled: mocks.getIsFeedbackDirectoriesEnabled,
}));

vi.mock("@/modules/hub/service", () => ({
  createTaxonomyRun: mocks.createTaxonomyRun,
  getActiveTaxonomyTree: mocks.getActiveTaxonomyTree,
  getTaxonomyRun: mocks.getTaxonomyRun,
  getTaxonomyTree: mocks.getTaxonomyTree,
  listTaxonomyFields: mocks.listTaxonomyFields,
  listTaxonomyNodeRecords: mocks.listTaxonomyNodeRecords,
  listTaxonomyRuns: mocks.listTaxonomyRuns,
  removeTaxonomyNode: mocks.removeTaxonomyNode,
  renameTaxonomyNode: mocks.renameTaxonomyNode,
}));

const ctx = {
  user: { id: "user_1" },
};

const organizationId = "org_1";
const workspaceId = "workspace_1";
const tenantId = "tenant_1";
const otherTenantId = "tenant_2";
const runId = "0c01906b-1e2a-7c80-b4fe-a4e5d1184526";
const nodeId = "0c01906b-1e2a-7c80-b4fe-a4e5d1184527";
const scope = {
  tenant_id: tenantId,
  source_type: "formbricks_survey",
  source_id: "survey_1",
  field_id: "question_1",
};

const taxonomyRun = {
  ...scope,
  id: runId,
  status: "succeeded",
  record_count: 20,
  embedding_count: 20,
  cluster_count: 3,
  node_count: 5,
  created_at: "2026-06-29T00:00:00.000Z",
  updated_at: "2026-06-29T00:00:00.000Z",
};

const taxonomyNode = {
  id: nodeId,
  run_id: runId,
  node_type: "leaf",
  label: "Support feedback",
  level: 4,
  sort_order: 0,
  created_at: "2026-06-29T00:00:00.000Z",
  updated_at: "2026-06-29T00:00:00.000Z",
};

const expectAuthorization = (minPermission: "read" | "readWrite") => {
  expect(mocks.checkAuthorizationUpdated).toHaveBeenCalledWith({
    userId: ctx.user.id,
    organizationId,
    access: [
      {
        type: "organization",
        roles: ["owner", "manager"],
      },
      {
        type: "workspaceTeam",
        minPermission,
        workspaceId,
      },
    ],
  });
};

const expectNoHubCalls = () => {
  expect(mocks.createTaxonomyRun).not.toHaveBeenCalled();
  expect(mocks.getActiveTaxonomyTree).not.toHaveBeenCalled();
  expect(mocks.getTaxonomyRun).not.toHaveBeenCalled();
  expect(mocks.getTaxonomyTree).not.toHaveBeenCalled();
  expect(mocks.listTaxonomyFields).not.toHaveBeenCalled();
  expect(mocks.listTaxonomyNodeRecords).not.toHaveBeenCalled();
  expect(mocks.listTaxonomyRuns).not.toHaveBeenCalled();
  expect(mocks.removeTaxonomyNode).not.toHaveBeenCalled();
  expect(mocks.renameTaxonomyNode).not.toHaveBeenCalled();
};

describe("taxonomy topics server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(organizationId);
    mocks.getIsFeedbackDirectoriesEnabled.mockResolvedValue(true);
    mocks.getFeedbackDirectoriesByWorkspaceId.mockResolvedValue([{ id: tenantId, name: "Seed directory" }]);

    mocks.listTaxonomyFields.mockResolvedValue({
      data: {
        data: [
          {
            ...scope,
            source_name: "Kitchen Sink Survey",
            field_label: "What do you think?",
            record_count: 20,
            embedding_count: 20,
          },
        ],
      },
    });
    mocks.getActiveTaxonomyTree.mockResolvedValue({ data: { run: taxonomyRun, root: taxonomyNode } });
    mocks.listTaxonomyRuns.mockResolvedValue({ data: { data: [taxonomyRun] } });
    mocks.createTaxonomyRun.mockResolvedValue({ data: { run: taxonomyRun, in_progress: false } });
    mocks.getTaxonomyRun.mockResolvedValue({ data: taxonomyRun });
    mocks.getTaxonomyTree.mockResolvedValue({ data: { run: taxonomyRun, root: taxonomyNode } });
    mocks.listTaxonomyNodeRecords.mockResolvedValue({ data: { data: [], limit: 25 } });
    mocks.renameTaxonomyNode.mockResolvedValue({ data: { ...taxonomyNode, label: "Renamed topic" } });
    mocks.removeTaxonomyNode.mockResolvedValue({
      data: { ...taxonomyNode, removed_at: "2026-06-29T00:00:00.000Z" },
    });
  });

  test("allows read actions with workspace read access and assigned feedback directory", async () => {
    await expect(
      getTaxonomyFieldsAction({ ctx, parsedInput: { workspaceId, directoryId: tenantId } } as any)
    ).resolves.toMatchObject({ unavailable: false });
    await expect(
      getTaxonomyStateAction({ ctx, parsedInput: { workspaceId, scope } } as any)
    ).resolves.toMatchObject({ activeTree: { run: taxonomyRun }, runs: [taxonomyRun], unavailable: false });
    await expect(
      getTaxonomyRunAction({ ctx, parsedInput: { workspaceId, scope, runId } } as any)
    ).resolves.toEqual(taxonomyRun);
    await expect(
      getTaxonomyTreeAction({ ctx, parsedInput: { workspaceId, scope, runId } } as any)
    ).resolves.toMatchObject({ run: taxonomyRun, root: taxonomyNode });
    await expect(
      getTaxonomyNodeRecordsAction({
        ctx,
        parsedInput: { workspaceId, tenantId, nodeId, limit: 25 },
      } as any)
    ).resolves.toEqual({ data: [], limit: 25 });

    expectAuthorization("read");
    expect(mocks.listTaxonomyFields).toHaveBeenCalledWith(tenantId);
    expect(mocks.getActiveTaxonomyTree).toHaveBeenCalledWith(scope);
    expect(mocks.listTaxonomyRuns).toHaveBeenCalledWith({ ...scope, limit: 5 });
    expect(mocks.getTaxonomyRun).toHaveBeenCalledWith(runId, tenantId);
    expect(mocks.getTaxonomyTree).toHaveBeenCalledWith(runId, tenantId);
    expect(mocks.listTaxonomyNodeRecords).toHaveBeenCalledWith(nodeId, { tenant_id: tenantId, limit: 25 });
  });

  test("blocks read actions when the user has no workspace access", async () => {
    mocks.checkAuthorizationUpdated.mockRejectedValueOnce(new AuthorizationError("Not authorized"));

    await expect(
      getTaxonomyFieldsAction({ ctx, parsedInput: { workspaceId, directoryId: tenantId } } as any)
    ).rejects.toThrow(AuthorizationError);

    expectAuthorization("read");
    expect(mocks.getFeedbackDirectoriesByWorkspaceId).not.toHaveBeenCalled();
    expectNoHubCalls();
  });

  test("blocks taxonomy actions when Unify Feedback is not enabled", async () => {
    mocks.getIsFeedbackDirectoriesEnabled.mockResolvedValueOnce(false);

    await expect(
      getTaxonomyFieldsAction({ ctx, parsedInput: { workspaceId, directoryId: tenantId } } as any)
    ).rejects.toThrow(OperationNotAllowedError);

    expect(mocks.checkAuthorizationUpdated).not.toHaveBeenCalled();
    expect(mocks.getFeedbackDirectoriesByWorkspaceId).not.toHaveBeenCalled();
    expectNoHubCalls();
  });

  test("blocks cross-directory taxonomy reads before calling Hub", async () => {
    await expect(
      getTaxonomyStateAction({
        ctx,
        parsedInput: { workspaceId, scope: { ...scope, tenant_id: otherTenantId } },
      } as any)
    ).rejects.toThrow(OperationNotAllowedError);

    expectAuthorization("read");
    expect(mocks.getFeedbackDirectoriesByWorkspaceId).toHaveBeenCalledWith(workspaceId);
    expectNoHubCalls();
  });

  test("allows generation, rename, and remove only with write permission", async () => {
    await expect(
      triggerTaxonomyRunAction({
        ctx,
        parsedInput: { workspaceId, scope, fieldLabel: "What do you think?" },
      } as any)
    ).resolves.toEqual({ run: taxonomyRun, inProgress: false });
    await expect(
      renameTaxonomyNodeAction({
        ctx,
        parsedInput: { workspaceId, tenantId, nodeId, label: "Renamed topic" },
      } as any)
    ).resolves.toMatchObject({ label: "Renamed topic" });
    await expect(
      removeTaxonomyNodeAction({ ctx, parsedInput: { workspaceId, tenantId, nodeId } } as any)
    ).resolves.toMatchObject({ removed_at: "2026-06-29T00:00:00.000Z" });

    expectAuthorization("readWrite");
    expect(mocks.createTaxonomyRun).toHaveBeenCalledWith({
      ...scope,
      field_label: "What do you think?",
      actor_id: ctx.user.id,
    });
    expect(mocks.renameTaxonomyNode).toHaveBeenCalledWith(nodeId, {
      tenant_id: tenantId,
      actor_id: ctx.user.id,
      label: "Renamed topic",
    });
    expect(mocks.removeTaxonomyNode).toHaveBeenCalledWith(nodeId, {
      tenant_id: tenantId,
      actor_id: ctx.user.id,
    });
  });

  test("blocks write actions for read-only users before calling Hub", async () => {
    mocks.checkAuthorizationUpdated.mockRejectedValueOnce(new AuthorizationError("Not authorized"));

    await expect(
      triggerTaxonomyRunAction({
        ctx,
        parsedInput: { workspaceId, scope, fieldLabel: "What do you think?" },
      } as any)
    ).rejects.toThrow(AuthorizationError);

    expectAuthorization("readWrite");
    expect(mocks.getFeedbackDirectoriesByWorkspaceId).not.toHaveBeenCalled();
    expectNoHubCalls();
  });

  test("blocks write actions for unassigned feedback directories before calling Hub", async () => {
    await expect(
      renameTaxonomyNodeAction({
        ctx,
        parsedInput: { workspaceId, tenantId: otherTenantId, nodeId, label: "Renamed topic" },
      } as any)
    ).rejects.toThrow(OperationNotAllowedError);

    expectAuthorization("readWrite");
    expect(mocks.getFeedbackDirectoriesByWorkspaceId).toHaveBeenCalledWith(workspaceId);
    expectNoHubCalls();
  });
});
