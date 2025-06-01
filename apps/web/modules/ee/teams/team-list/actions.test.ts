import { ZTeamSettingsFormSchema } from "@/modules/ee/teams/team-list/types/team";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createTeamAction,
  deleteTeamAction,
  getTeamDetailsAction,
  getTeamRoleAction,
  updateTeamDetailsAction,
} from "./actions";

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    schema: () => ({
      action: (fn: any) => fn,
    }),
  },
  checkAuthorizationUpdated: vi.fn(),
}));
vi.mock("@/lib/utils/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromTeamId: vi.fn(async (id: string) => `org-${id}`),
}));
vi.mock("@/modules/ee/role-management/actions", () => ({
  checkRoleManagementPermission: vi.fn(),
}));
vi.mock("@/modules/ee/teams/lib/roles", () => ({
  getTeamRoleByTeamIdUserId: vi.fn(async () => "admin"),
}));
vi.mock("@/modules/ee/teams/team-list/lib/team", () => ({
  createTeam: vi.fn(async () => "team-created"),
  getTeamDetails: vi.fn(async () => ({ id: "team-1" })),
  deleteTeam: vi.fn(async () => true),
  updateTeamDetails: vi.fn(async () => ({ updated: true })),
}));

describe("action.ts", () => {
  const ctx = {
    user: { id: "user-1" },
    auditLoggingCtx: {},
  } as any;
  afterEach(() => {
    cleanup();
  });

  test("createTeamAction calls dependencies and returns result", async () => {
    const result = await createTeamAction({
      ctx,
      parsedInput: { organizationId: "org-1", name: "Team X" },
    } as any);
    expect(result).toBe("team-created");
  });

  test("getTeamDetailsAction calls dependencies and returns result", async () => {
    const result = await getTeamDetailsAction({
      ctx,
      parsedInput: { teamId: "team-1" },
    } as any);
    expect(result).toEqual({ id: "team-1" });
  });

  test("deleteTeamAction calls dependencies and returns result", async () => {
    const result = await deleteTeamAction({
      ctx,
      parsedInput: { teamId: "team-1" },
    } as any);
    expect(result).toBe(true);
  });

  test("updateTeamDetailsAction calls dependencies and returns result", async () => {
    const result = await updateTeamDetailsAction({
      ctx,
      parsedInput: { teamId: "team-1", data: {} as typeof ZTeamSettingsFormSchema._type },
    } as any);
    expect(result).toEqual({ updated: true });
  });

  test("getTeamRoleAction calls dependencies and returns result", async () => {
    const result = await getTeamRoleAction({
      ctx,
      parsedInput: { teamId: "team-1" },
    } as any);
    expect(result).toBe("admin");
  });
});
