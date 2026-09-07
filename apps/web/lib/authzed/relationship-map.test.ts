import { describe, expect, test } from "vitest";
import {
  ApiKeyPermission,
  OrganizationRole,
  TeamUserRole,
  WorkspaceTeamPermission,
} from "@formbricks/database/prisma";
import {
  ORGANIZATION_ACCESS_RELATIONS,
  ORGANIZATION_RELATIONS,
  TEAM_RELATIONS,
  WORKSPACE_API_KEY_RELATIONS,
  WORKSPACE_TEAM_RELATIONS,
  normalizeOrganizationAccess,
} from "./relationship-map";

/**
 * These assertions pin relation names against the deployed `authzed/schema.zed`.
 *
 * Renaming a relation on one side only is the failure this file exists to catch: reconciling tooling
 * derives the expected relationship set from these maps, so a mismatch makes it read correct
 * relationships as orphaned and, when pruning, delete real access. A change here is a schema change
 * and must be paired with one.
 */
describe("relation name mappings", () => {
  test("maps every organization role to its schema relation", () => {
    expect(ORGANIZATION_RELATIONS).toEqual({
      [OrganizationRole.billing]: "billing",
      [OrganizationRole.manager]: "manager",
      [OrganizationRole.member]: "member",
      [OrganizationRole.owner]: "owner",
    });
  });

  test("maps every team role to its schema relation", () => {
    expect(TEAM_RELATIONS).toEqual({
      [TeamUserRole.admin]: "admin",
      [TeamUserRole.contributor]: "contributor",
    });
  });

  test("maps every workspace-team permission to its team-suffixed schema relation", () => {
    expect(WORKSPACE_TEAM_RELATIONS).toEqual({
      [WorkspaceTeamPermission.manage]: "manager_team",
      [WorkspaceTeamPermission.read]: "reader_team",
      [WorkspaceTeamPermission.readWrite]: "writer_team",
    });
  });

  test("maps every API-key permission to its bare workspace schema relation", () => {
    // Deliberately unsuffixed, unlike the team grants above: the schema distinguishes an API-key
    // subject from a team subject by relation name.
    expect(WORKSPACE_API_KEY_RELATIONS).toEqual({
      [ApiKeyPermission.manage]: "manager",
      [ApiKeyPermission.read]: "reader",
      [ApiKeyPermission.write]: "writer",
    });
  });

  test("maps organization access flags to their api-key-subject schema relations", () => {
    expect(ORGANIZATION_ACCESS_RELATIONS).toEqual({
      read: "api_key_reader",
      write: "api_key_writer",
    });
  });

  test.each([
    ["every Prisma organization role", Object.keys(OrganizationRole), ORGANIZATION_RELATIONS],
    ["every Prisma team role", Object.keys(TeamUserRole), TEAM_RELATIONS],
    [
      "every Prisma workspace-team permission",
      Object.keys(WorkspaceTeamPermission),
      WORKSPACE_TEAM_RELATIONS,
    ],
    ["every Prisma API-key permission", Object.keys(ApiKeyPermission), WORKSPACE_API_KEY_RELATIONS],
  ])("covers %s with a distinct relation", (_label, sourceValues, relations) => {
    expect(Object.keys(relations).sort()).toEqual([...sourceValues].sort());
    // Two source values sharing a relation would make the projectors' touch-one/delete-the-alternates
    // logic delete the relation it just wrote.
    expect(new Set(Object.values(relations)).size).toBe(sourceValues.length);
  });
});

describe("normalizeOrganizationAccess", () => {
  test("reads both flags independently", () => {
    expect(normalizeOrganizationAccess({ accessControl: { read: true, write: true } })).toEqual({
      read: true,
      write: true,
    });
    expect(normalizeOrganizationAccess({ accessControl: { read: true, write: false } })).toEqual({
      read: true,
      write: false,
    });
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "read"],
    ["an array", []],
    ["an empty object", {}],
    ["a non-object accessControl", { accessControl: "read" }],
    ["a null accessControl", { accessControl: null }],
    ["an accessControl array", { accessControl: [] }],
  ])("denies both flags for %s", (_label, value) => {
    expect(normalizeOrganizationAccess(value)).toEqual({ read: false, write: false });
  });

  test.each([
    ["a truthy string", "true"],
    ["the number one", 1],
    ["a truthy object", {}],
  ])("denies %s rather than coercing it to a grant", (_label, flagValue) => {
    expect(normalizeOrganizationAccess({ accessControl: { read: flagValue, write: flagValue } })).toEqual({
      read: false,
      write: false,
    });
  });
});
