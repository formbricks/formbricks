import { ProjectTeamPermission, TeamUserRole } from "@prisma/client";
import { describe, expect, test } from "vitest";
import { TeamPermissionMapping, TeamRoleMapping, getTeamAccessFlags, getTeamPermissionFlags } from "./teams";

describe("TeamPermissionMapping", () => {
  test("maps ProjectTeamPermission to correct labels", () => {
    expect(TeamPermissionMapping[ProjectTeamPermission.read]).toBe("Read");
    expect(TeamPermissionMapping[ProjectTeamPermission.readWrite]).toBe("Read & write");
    expect(TeamPermissionMapping[ProjectTeamPermission.manage]).toBe("Manage");
  });
});

describe("TeamRoleMapping", () => {
  test("maps TeamUserRole to correct labels", () => {
    expect(TeamRoleMapping[TeamUserRole.admin]).toBe("Team Admin");
    expect(TeamRoleMapping[TeamUserRole.contributor]).toBe("Contributor");
  });
});

describe("getTeamAccessFlags", () => {
  test("returns correct flags for admin", () => {
    expect(getTeamAccessFlags(TeamUserRole.admin)).toEqual({ isAdmin: true, isContributor: false });
  });
  test("returns correct flags for contributor", () => {
    expect(getTeamAccessFlags(TeamUserRole.contributor)).toEqual({ isAdmin: false, isContributor: true });
  });
  test("returns false flags for undefined/null", () => {
    expect(getTeamAccessFlags()).toEqual({ isAdmin: false, isContributor: false });
    expect(getTeamAccessFlags(null)).toEqual({ isAdmin: false, isContributor: false });
  });
});

describe("getTeamPermissionFlags", () => {
  test("returns correct flags for read", () => {
    expect(getTeamPermissionFlags(ProjectTeamPermission.read)).toEqual({
      hasReadAccess: true,
      hasReadWriteAccess: false,
      hasManageAccess: false,
    });
  });
  test("returns correct flags for readWrite", () => {
    expect(getTeamPermissionFlags(ProjectTeamPermission.readWrite)).toEqual({
      hasReadAccess: false,
      hasReadWriteAccess: true,
      hasManageAccess: false,
    });
  });
  test("returns correct flags for manage", () => {
    expect(getTeamPermissionFlags(ProjectTeamPermission.manage)).toEqual({
      hasReadAccess: false,
      hasReadWriteAccess: false,
      hasManageAccess: true,
    });
  });
  test("returns all false for undefined/null", () => {
    expect(getTeamPermissionFlags()).toEqual({
      hasReadAccess: false,
      hasReadWriteAccess: false,
      hasManageAccess: false,
    });
    expect(getTeamPermissionFlags(null)).toEqual({
      hasReadAccess: false,
      hasReadWriteAccess: false,
      hasManageAccess: false,
    });
  });
});
