import "server-only";
import { getMembershipsByUserId } from "@/lib/membership/service";

export type TPostHogOrganizationRoleProperties = {
  // Full snapshot, not just "the org I'm currently looking at" — a person can belong to several
  // organizations with different roles, and PostHog person properties are a single flat value per
  // key, not scoped per relationship. Filter on this via HogQL (arrayExists / JSONExtract), e.g.
  // organization_roles contains { role: "owner" }, rather than a flattened boolean field.
  organization_roles: { organization_id: string; role: string }[];
  organization_count: number;
};

/**
 * Builds the full role snapshot for a user by re-reading every membership row, rather than patching a
 * single "current org" value. Recomputing from the database on every call makes each identify call
 * idempotent regardless of order or which org triggered it, and self-heals stale entries (a role
 * change or org removal elsewhere is picked up the next time this runs) instead of requiring every
 * mutation site to know to update PostHog.
 */
export const getOrganizationRolePersonProperties = async (
  userId: string
): Promise<TPostHogOrganizationRoleProperties> => {
  const memberships = await getMembershipsByUserId(userId);

  return {
    organization_roles: memberships.map((membership) => ({
      organization_id: membership.organizationId,
      role: membership.role,
    })),
    organization_count: memberships.length,
  };
};
