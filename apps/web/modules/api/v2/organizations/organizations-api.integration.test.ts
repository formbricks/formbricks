import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { TApiOwner, callRoute, createOwnerApiKey, seedOwner } from "@/integration/api-routes";
import { resetDb } from "@/integration/reset-db";
import { GET as getMe } from "@/modules/api/v2/me/route";
import {
  DELETE as deleteTeam,
  GET as getTeam,
  PUT as updateTeam,
} from "@/modules/api/v2/organizations/[organizationId]/teams/[teamId]/route";
import {
  POST as createTeam,
  GET as listTeams,
} from "@/modules/api/v2/organizations/[organizationId]/teams/route";
import {
  POST as createUser,
  GET as listUsers,
  PATCH as updateUser,
} from "@/modules/api/v2/organizations/[organizationId]/users/route";
import {
  POST as createWorkspaceTeam,
  DELETE as deleteWorkspaceTeam,
  GET as listWorkspaceTeams,
  PUT as updateWorkspaceTeam,
} from "@/modules/api/v2/organizations/[organizationId]/workspace-teams/route";

/**
 * Organization API journeys (`/api/v2/organizations/{organizationId}/…`) against the real Postgres and
 * SpiceDB, with an organization key that has access-control read and write, as the settings dialog
 * creates it. Moved from `playwright/api/organization/{team,user,workspace-team}.spec.ts` (ENG-7518).
 */

let owner: TApiOwner;
let apiKey: string;

beforeEach(async () => {
  await resetDb();
  owner = await seedOwner();
  apiKey = await createOwnerApiKey(owner);
});

const orgPath = (suffix: string) => `/api/v2/organizations/${owner.organizationId}/${suffix}`;
const orgParams = () => ({ organizationId: owner.organizationId });

const createTeamNamed = async (name: string): Promise<string> => {
  const created = await callRoute(createTeam, {
    method: "POST",
    path: orgPath("teams"),
    params: orgParams(),
    apiKey,
    body: { organizationId: owner.organizationId, name },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  expect(created.body.data.name).toBe(name);
  return created.body.data.id;
};

test("GET /api/v2/me reports the key's organization and workspace", async () => {
  const response = await callRoute(getMe, { path: "/api/v2/me", apiKey });

  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({
    organizationId: owner.organizationId,
    workspacePermissions: [
      expect.objectContaining({ workspaceId: owner.workspaceId, permissions: "manage" }),
    ],
  });
});

describe("teams", () => {
  test("creates, lists, updates, reads and deletes a team", async () => {
    const teamId = await createTeamNamed("New Team from API");

    const listed = await callRoute(listTeams, {
      path: orgPath("teams"),
      params: orgParams(),
      apiKey,
      query: { limit: 10, skip: 0, sortBy: "createdAt", order: "asc" },
    });
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([expect.objectContaining({ id: teamId })]);

    const teamParams = { ...orgParams(), teamId };
    const updated = await callRoute(updateTeam, {
      method: "PUT",
      path: orgPath(`teams/${teamId}`),
      params: teamParams,
      apiKey,
      body: { name: "Updated Team from API" },
    });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.data.name).toBe("Updated Team from API");

    const read = await callRoute(getTeam, { path: orgPath(`teams/${teamId}`), params: teamParams, apiKey });
    expect(read.status).toBe(200);
    expect(read.body.data).toMatchObject({ id: teamId, name: "Updated Team from API" });

    const deleted = await callRoute(deleteTeam, {
      method: "DELETE",
      path: orgPath(`teams/${teamId}`),
      params: teamParams,
      apiKey,
    });
    expect(deleted.status).toBe(200);
  });
});

describe("users", () => {
  test("creates a user in a team, lists and filters them, then updates them partly and fully", async () => {
    const teamName = "New Team from API";
    await createTeamNamed(teamName);
    const email = "usere2etest@formbricks-test.com";

    const created = await callRoute(createUser, {
      method: "POST",
      path: orgPath("users"),
      params: orgParams(),
      apiKey,
      body: { name: "E2E Test User", email, role: "manager", isActive: true, teams: [teamName] },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.data.name).toBe("E2E Test User");
    const userId: string = created.body.data.id;

    const listed = await callRoute(listUsers, { path: orgPath("users"), params: orgParams(), apiKey });
    expect(listed.status).toBe(200);
    expect(listed.body.data.some((user: { id: string }) => user.id === userId)).toBe(true);

    const filtered = await callRoute(listUsers, {
      path: orgPath("users"),
      params: orgParams(),
      apiKey,
      query: { email },
    });
    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toEqual([expect.objectContaining({ id: userId, email })]);

    const renamed = await callRoute(updateUser, {
      method: "PATCH",
      path: orgPath("users"),
      params: orgParams(),
      apiKey,
      body: { email, name: "Updated E2E Name" },
    });
    expect(renamed.status, JSON.stringify(renamed.body)).toBe(200);
    expect(renamed.body.data.name).toBe("Updated E2E Name");

    const replaced = await callRoute(updateUser, {
      method: "PATCH",
      path: orgPath("users"),
      params: orgParams(),
      apiKey,
      body: { email, name: "Fully Updated E2E", role: "member", teams: [], isActive: false },
    });
    expect(replaced.status, JSON.stringify(replaced.body)).toBe(200);
    expect(replaced.body.data).toMatchObject({
      name: "Fully Updated E2E",
      role: "member",
      isActive: false,
      teams: [],
    });
  });

  // ENG-6698: a user who also belongs to another organization is reported, and changed, with this
  // organization's membership and teams only. The other organization has a team with the same name, so
  // a lookup by name that forgot the organization would surface or touch it.
  test("reads and writes only this organization's role and teams of a user in two organizations", async () => {
    const other = await seedOwner("other");
    const ours = await prisma.team.create({ data: { name: "Ours", organizationId: owner.organizationId } });
    const theirs = await Promise.all(
      ["Ours", "Theirs"].map((name) =>
        prisma.team.create({ data: { name, organizationId: other.organizationId } })
      )
    );
    await prisma.membership.create({
      data: { userId: other.userId, organizationId: owner.organizationId, role: "member" },
    });
    await prisma.teamUser.createMany({
      data: [ours, ...theirs].map(({ id: teamId }) => ({
        teamId,
        userId: other.userId,
        role: "admin" as const,
      })),
    });

    const listed = await callRoute(listUsers, {
      path: orgPath("users"),
      params: orgParams(),
      apiKey,
      query: { email: other.email },
    });
    expect(listed.status, JSON.stringify(listed.body)).toBe(200);
    expect(listed.body.data).toEqual([
      {
        id: other.userId,
        email: other.email,
        name: "other",
        role: "member",
        teams: ["Ours"],
        isActive: true,
        lastLoginAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    ]);

    const updated = await callRoute(updateUser, {
      method: "PATCH",
      path: orgPath("users"),
      params: orgParams(),
      apiKey,
      body: { email: other.email, teams: [] },
    });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.data).toMatchObject({ id: other.userId, role: "member", teams: [] });
    expect(Object.keys(updated.body.data).sort()).toEqual(Object.keys(listed.body.data[0]).sort());

    const remaining = await prisma.teamUser.findMany({
      where: { userId: other.userId },
      select: { teamId: true },
    });
    expect(remaining.map(({ teamId }) => teamId).sort()).toEqual(theirs.map(({ id }) => id).sort());
    const memberships = await prisma.membership.findMany({
      where: { userId: other.userId },
      select: { organizationId: true, role: true },
    });
    expect(memberships).toEqual(
      expect.arrayContaining([
        { organizationId: owner.organizationId, role: "member" },
        { organizationId: other.organizationId, role: "owner" },
      ])
    );
  });
});

describe("workspace teams", () => {
  test("grants a team a workspace, lists, changes and revokes the grant", async () => {
    const teamId = await createTeamNamed("New Team from API");
    const grant = { teamId, workspaceId: owner.workspaceId };

    const created = await callRoute(createWorkspaceTeam, {
      method: "POST",
      path: orgPath("workspace-teams"),
      params: orgParams(),
      apiKey,
      body: { ...grant, permission: "readWrite" },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(200);

    const listed = await callRoute(listWorkspaceTeams, {
      path: orgPath("workspace-teams"),
      params: orgParams(),
      apiKey,
      query: grant,
    });
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([expect.objectContaining({ ...grant, permission: "readWrite" })]);

    const updated = await callRoute(updateWorkspaceTeam, {
      method: "PUT",
      path: orgPath("workspace-teams"),
      params: orgParams(),
      apiKey,
      body: { ...grant, permission: "read" },
    });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.data.permission).toBe("read");

    const deleted = await callRoute(deleteWorkspaceTeam, {
      method: "DELETE",
      path: orgPath("workspace-teams"),
      params: orgParams(),
      apiKey,
      query: grant,
    });
    expect(deleted.status).toBe(200);
  });
});
