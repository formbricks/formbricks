import { describe, expect, test } from "vitest";
import {
  getMcpCategoryLabel,
  getMcpCategoryLevelLabel,
  getMcpDependencyHint,
  getMcpPermissionLabel,
} from "./grant-editor-labels";
import { MCP_PERMISSIONS, MCP_PERMISSION_CATEGORIES, type TMcpPermission } from "./permissions";

/** Echoes the key, and the values it was given, so a test sees which string was asked for. */
const t = (key: string, values?: Record<string, string>) =>
  values ? `${key} ${JSON.stringify(values)}` : key;

describe("grant editor labels", () => {
  test("every category and permission in the registry has a translated label", () => {
    for (const category of MCP_PERMISSION_CATEGORIES) {
      expect(getMcpCategoryLabel(category, t)).toMatch(/^auth\.oauth\.grant\.categories\./);
    }
    for (const permission of Object.keys(MCP_PERMISSIONS) as TMcpPermission[]) {
      expect(getMcpPermissionLabel(permission, t)).toMatch(/^auth\.oauth\.grant\.permissions\./);
    }
  });

  test("a dependency hint names the permission and level it needs", () => {
    expect(getMcpDependencyHint({ permission: "feedbackRecords", level: "read" }, t)).toBe(
      'auth.oauth.grant.needs_permission {"permission":"auth.oauth.grant.permissions.feedback_records","level":"auth.oauth.grant.levels.read"}'
    );
  });

  test("a category whose permissions differ reads as a custom level, the others as their level", () => {
    expect(getMcpCategoryLevelLabel("mixed", t)).toBe("auth.oauth.grant.levels.custom");
    expect(getMcpCategoryLevelLabel("none", t)).toBe("auth.oauth.grant.levels.no_access");
  });
});
