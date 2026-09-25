import type { TFunction } from "i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";

/**
 * Organization role labels, resolved through `t()` so they render in the viewer's language.
 *
 * The keys are spelled out literally rather than built from the enum value: `scan-translations`
 * reports a key reached only through a lookup table as unused and fails the build. This mirrors
 * `rolesDescription` in `add-member-role.tsx`, which resolves the matching `*_role_description`
 * keys the same way.
 *
 * The enum values are lowercase (`owner`), which is why the render sites used to pair the raw value
 * with a `capitalize` class. Translated labels carry their own casing, so that class goes away.
 */
export const getOrganizationRoleLabels = (t: TFunction): Record<TOrganizationRole, string> => ({
  owner: t("workspace.settings.teams.owner"),
  manager: t("workspace.settings.teams.manager"),
  member: t("workspace.settings.teams.member"),
  billing: t("workspace.settings.teams.billing"),
});

export const getAccessFlags = (role?: TOrganizationRole) => {
  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isBilling = role === "billing";
  const isMember = role === "member";

  return {
    isManager,
    isOwner,
    isBilling,
    isMember,
  };
};

export const getUserManagementAccess = (
  role: TOrganizationRole,
  minimumRole: "owner" | "manager" | "disabled"
): boolean => {
  // If minimum role is "disabled", no one has access
  if (minimumRole === "disabled") {
    return false;
  }
  if (minimumRole === "owner") {
    return role === "owner";
  }

  if (minimumRole === "manager") {
    return role === "owner" || role === "manager";
  }
  return false;
};
