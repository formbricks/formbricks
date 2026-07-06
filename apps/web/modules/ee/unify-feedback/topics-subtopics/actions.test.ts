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

type MockedActionCall<TInput, TResult> = (args: { ctx: typeof ctx; parsedInput: TInput }) => Promise<TResult>;

const callAction = <TInput, TResult>(
  action: (input: TInput) => Promise<TResult>,
  parsedInput: TInput
): Promise<TResult> => {
  const handler = action as unknown as MockedActionCall<TInput, TResult>;
  return handler({ ctx, parsedInput });
};

const callGetTaxonomyFieldsAction = (parsedInput: Parameters<typeof getTaxonomyFieldsAction>[0]) =>
  callAction(getTaxonomyFieldsAction, parsedInput);

const callGetTaxonomyStateAction = (parsedInput: Parameters<typeof getTaxonomyStateAction>[0]) =>
  callAction(getTaxonomyStateAction, parsedInput);

const callGetTaxonomyRunAction = (parsedInput: Parameters<typeof getTaxonomyRunAction>[0]) =>
  callAction(getTaxonomyRunAction, parsedInput);

const callGetTaxonomyTreeAction = (parsedInput: Parameters<typeof getTaxonomyTreeAction>[0]) =>
  callAction(getTaxonomyTreeAction, parsedInput);

const callGetTaxonomyNodeRecordsAction = (parsedInput: Parameters<typeof getTaxonomyNodeRecordsAction>[0]) =>
  callAction(getTaxonomyNodeRecordsAction, parsedInput);

const callTriggerTaxonomyRunAction = (parsedInput: Parameters<typeof triggerTaxonomyRunAction>[0]) =>
  callAction(triggerTaxonomyRunAction, parsedInput);

const callRenameTaxonomyNodeAction = (parsedInput: Parameters<typeof renameTaxonomyNodeAction>[0]) =>
  callAction(renameTaxonomyNodeAction, parsedInput);

const callRemoveTaxonomyNodeAction = (parsedInput: Parameters<typeof removeTaxonomyNodeAction>[0]) =>
  callAction(removeTaxonomyNodeAction, parsedInput);

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
  expect(mocks.checkAuthorizationUpdated).toHaveBeenCalledTimes(1);
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

const expectDirectoryAccess = () => {
  expect(mocks.getFeedbackDirectoriesByWorkspaceId).toHaveBeenCalledTimes(1);
  expect(mocks.getFeedbackDirectoriesByWorkspaceId).toHaveBeenCalledWith(workspaceId);
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

  test("allows taxonomy field reads with workspace read access and assigned feedback directory", async () => {
    await expect(callGetTaxonomyFieldsAction({ workspaceId, directoryId: tenantId })).resolves.toMatchObject({
      unavailable: false,
    });

    expectAuthorization("read");
    expectDirectoryAccess();
    expect(mocks.listTaxonomyFields).toHaveBeenCalledTimes(1);
    expect(mocks.listTaxonomyFields).toHaveBeenCalledWith(tenantId);
  });

  test("allows taxonomy state reads with workspace read access and assigned feedback directory", async () => {
    await expect(callGetTaxonomyStateAction({ workspaceId, scope })).resolves.toMatchObject({
      activeTree: { run: taxonomyRun },
      runs: [taxonomyRun],
      unavailable: false,
    });

    expectAuthorization("read");
    expectDirectoryAccess();
    expect(mocks.getActiveTaxonomyTree).toHaveBeenCalledTimes(1);
    expect(mocks.getActiveTaxonomyTree).toHaveBeenCalledWith(scope);
    expect(mocks.listTaxonomyRuns).toHaveBeenCalledTimes(1);
    expect(mocks.listTaxonomyRuns).toHaveBeenCalledWith({ ...scope, limit: 5 });
  });

  test("allows taxonomy run reads with workspace read access and assigned feedback directory", async () => {
    await expect(callGetTaxonomyRunAction({ workspaceId, scope, runId })).resolves.toEqual(taxonomyRun);

    expectAuthorization("read");
    expectDirectoryAccess();
    expect(mocks.getTaxonomyRun).toHaveBeenCalledTimes(1);
    expect(mocks.getTaxonomyRun).toHaveBeenCalledWith(runId, tenantId);
  });

  test("allows taxonomy tree reads with workspace read access and assigned feedback directory", async () => {
    await expect(callGetTaxonomyTreeAction({ workspaceId, scope, runId })).resolves.toMatchObject({
      run: taxonomyRun,
      root: taxonomyNode,
    });

    expectAuthorization("read");
    expectDirectoryAccess();
    expect(mocks.getTaxonomyTree).toHaveBeenCalledTimes(1);
    expect(mocks.getTaxonomyTree).toHaveBeenCalledWith(runId, tenantId);
  });

  test("allows taxonomy node record reads with workspace read access and assigned feedback directory", async () => {
    await expect(
      callGetTaxonomyNodeRecordsAction({ workspaceId, tenantId, nodeId, limit: 25 })
    ).resolves.toEqual({ data: [], limit: 25 });

    expectAuthorization("read");
    expectDirectoryAccess();
    expect(mocks.listTaxonomyNodeRecords).toHaveBeenCalledTimes(1);
    expect(mocks.listTaxonomyNodeRecords).toHaveBeenCalledWith(nodeId, { tenant_id: tenantId, limit: 25 });
  });

  test("allows taxonomy generation with workspace write access and assigned feedback directory", async () => {
    await expect(
      callTriggerTaxonomyRunAction({ workspaceId, scope, fieldLabel: "What do you think?" })
    ).resolves.toEqual({ run: taxonomyRun, inProgress: false });

    expectAuthorization("readWrite");
    expectDirectoryAccess();
    expect(mocks.createTaxonomyRun).toHaveBeenCalledTimes(1);
    expect(mocks.createTaxonomyRun).toHaveBeenCalledWith({
      ...scope,
      field_label: "What do you think?",
      actor_id: ctx.user.id,
    });
  });

  test("allows taxonomy node renames with workspace write access and assigned feedback directory", async () => {
    await expect(
      callRenameTaxonomyNodeAction({ workspaceId, tenantId, nodeId, label: "Renamed topic" })
    ).resolves.toMatchObject({ label: "Renamed topic" });

    expectAuthorization("readWrite");
    expectDirectoryAccess();
    expect(mocks.renameTaxonomyNode).toHaveBeenCalledTimes(1);
    expect(mocks.renameTaxonomyNode).toHaveBeenCalledWith(nodeId, {
      tenant_id: tenantId,
      actor_id: ctx.user.id,
      label: "Renamed topic",
    });
  });

  test("allows taxonomy node removals with workspace write access and assigned feedback directory", async () => {
    await expect(callRemoveTaxonomyNodeAction({ workspaceId, tenantId, nodeId })).resolves.toMatchObject({
      removed_at: "2026-06-29T00:00:00.000Z",
    });

    expectAuthorization("readWrite");
    expectDirectoryAccess();
    expect(mocks.removeTaxonomyNode).toHaveBeenCalledTimes(1);
    expect(mocks.removeTaxonomyNode).toHaveBeenCalledWith(nodeId, {
      tenant_id: tenantId,
      actor_id: ctx.user.id,
    });
  });

  test("blocks taxonomy actions when Unify Feedback is not enabled", async () => {
    mocks.getIsFeedbackDirectoriesEnabled.mockResolvedValueOnce(false);

    await expect(callGetTaxonomyFieldsAction({ workspaceId, directoryId: tenantId })).rejects.toThrow(
      OperationNotAllowedError
    );

    expect(mocks.checkAuthorizationUpdated).not.toHaveBeenCalled();
    expect(mocks.getFeedbackDirectoriesByWorkspaceId).not.toHaveBeenCalled();
    expectNoHubCalls();
  });

  test.each([
    {
      name: "getTaxonomyFieldsAction",
      minPermission: "read" as const,
      run: () => callGetTaxonomyFieldsAction({ workspaceId, directoryId: tenantId }),
    },
    {
      name: "getTaxonomyStateAction",
      minPermission: "read" as const,
      run: () => callGetTaxonomyStateAction({ workspaceId, scope }),
    },
    {
      name: "getTaxonomyRunAction",
      minPermission: "read" as const,
      run: () => callGetTaxonomyRunAction({ workspaceId, scope, runId }),
    },
    {
      name: "getTaxonomyTreeAction",
      minPermission: "read" as const,
      run: () => callGetTaxonomyTreeAction({ workspaceId, scope, runId }),
    },
    {
      name: "getTaxonomyNodeRecordsAction",
      minPermission: "read" as const,
      run: () => callGetTaxonomyNodeRecordsAction({ workspaceId, tenantId, nodeId, limit: 25 }),
    },
    {
      name: "triggerTaxonomyRunAction",
      minPermission: "readWrite" as const,
      run: () => callTriggerTaxonomyRunAction({ workspaceId, scope, fieldLabel: "What do you think?" }),
    },
    {
      name: "renameTaxonomyNodeAction",
      minPermission: "readWrite" as const,
      run: () => callRenameTaxonomyNodeAction({ workspaceId, tenantId, nodeId, label: "Renamed topic" }),
    },
    {
      name: "removeTaxonomyNodeAction",
      minPermission: "readWrite" as const,
      run: () => callRemoveTaxonomyNodeAction({ workspaceId, tenantId, nodeId }),
    },
  ])("blocks $name when the user has no workspace access", async ({ minPermission, run }) => {
    mocks.checkAuthorizationUpdated.mockRejectedValueOnce(new AuthorizationError("Not authorized"));

    await expect(run()).rejects.toThrow(AuthorizationError);

    expectAuthorization(minPermission);
    expect(mocks.getFeedbackDirectoriesByWorkspaceId).not.toHaveBeenCalled();
    expectNoHubCalls();
  });

  test.each([
    {
      name: "getTaxonomyFieldsAction",
      minPermission: "read" as const,
      run: () => callGetTaxonomyFieldsAction({ workspaceId, directoryId: otherTenantId }),
    },
    {
      name: "getTaxonomyStateAction",
      minPermission: "read" as const,
      run: () => callGetTaxonomyStateAction({ workspaceId, scope: { ...scope, tenant_id: otherTenantId } }),
    },
    {
      name: "getTaxonomyRunAction",
      minPermission: "read" as const,
      run: () =>
        callGetTaxonomyRunAction({ workspaceId, scope: { ...scope, tenant_id: otherTenantId }, runId }),
    },
    {
      name: "getTaxonomyTreeAction",
      minPermission: "read" as const,
      run: () =>
        callGetTaxonomyTreeAction({ workspaceId, scope: { ...scope, tenant_id: otherTenantId }, runId }),
    },
    {
      name: "getTaxonomyNodeRecordsAction",
      minPermission: "read" as const,
      run: () =>
        callGetTaxonomyNodeRecordsAction({ workspaceId, tenantId: otherTenantId, nodeId, limit: 25 }),
    },
    {
      name: "triggerTaxonomyRunAction",
      minPermission: "readWrite" as const,
      run: () =>
        callTriggerTaxonomyRunAction({
          workspaceId,
          scope: { ...scope, tenant_id: otherTenantId },
          fieldLabel: "What do you think?",
        }),
    },
    {
      name: "renameTaxonomyNodeAction",
      minPermission: "readWrite" as const,
      run: () =>
        callRenameTaxonomyNodeAction({
          workspaceId,
          tenantId: otherTenantId,
          nodeId,
          label: "Renamed topic",
        }),
    },
    {
      name: "removeTaxonomyNodeAction",
      minPermission: "readWrite" as const,
      run: () => callRemoveTaxonomyNodeAction({ workspaceId, tenantId: otherTenantId, nodeId }),
    },
  ])(
    "blocks $name for unassigned feedback directories before calling Hub",
    async ({ minPermission, run }) => {
      await expect(run()).rejects.toThrow(OperationNotAllowedError);

      expectAuthorization(minPermission);
      expectDirectoryAccess();
      expectNoHubCalls();
    }
  );
});
