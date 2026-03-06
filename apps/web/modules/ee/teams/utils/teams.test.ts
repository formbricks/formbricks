import { describe, expect, test } from "vitest";
import { ZTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { ZTeamRole } from "@/modules/ee/teams/team-list/types/team";
import { TeamPermissionMapping, TeamRoleMapping, getTeamAccessFlags, getTeamPermissionFlags } from "./teams";

describe("TeamPermissionMapping", () => {
  test("maps ProjectTeamPermission to correct labels", () => {
    expect(TeamPermissionMapping[ZTeamPermission.enum.read]).toBe("Read");
    expect(TeamPermissionMapping[ZTeamPermission.enum.readWrite]).toBe("Read & write");
    expect(TeamPermissionMapping[ZTeamPermission.enum.manage]).toBe("Manage");
  });
});

describe("TeamRoleMapping", () => {
  test("maps TeamUserRole to correct labels", () => {
    expect(TeamRoleMapping[ZTeamRole.enum.admin]).toBe("Team Admin");
    expect(TeamRoleMapping[ZTeamRole.enum.contributor]).toBe("Contributor");
  });
});

describe("getTeamAccessFlags", () => {
  test("returns correct flags for admin", () => {
    expect(getTeamAccessFlags(ZTeamRole.enum.admin)).toEqual({ isAdmin: true, isContributor: false });
  });
  test("returns correct flags for contributor", () => {
    expect(getTeamAccessFlags(ZTeamRole.enum.contributor)).toEqual({ isAdmin: false, isContributor: true });
  });
  test("returns false flags for undefined/null", () => {
    expect(getTeamAccessFlags()).toEqual({ isAdmin: false, isContributor: false });
    expect(getTeamAccessFlags(null)).toEqual({ isAdmin: false, isContributor: false });
  });
});

describe("getTeamPermissionFlags", () => {
  test("returns correct flags for read", () => {
    expect(getTeamPermissionFlags(ZTeamPermission.enum.read)).toEqual({
      hasReadAccess: true,
      hasReadWriteAccess: false,
      hasManageAccess: false,
    });
  });
  test("returns correct flags for readWrite", () => {
    expect(getTeamPermissionFlags(ZTeamPermission.enum.readWrite)).toEqual({
      hasReadAccess: false,
      hasReadWriteAccess: true,
      hasManageAccess: false,
    });
  });
  test("returns correct flags for manage", () => {
    expect(getTeamPermissionFlags(ZTeamPermission.enum.manage)).toEqual({
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
