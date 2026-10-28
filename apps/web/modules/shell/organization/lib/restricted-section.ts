import "server-only";
import { redirect } from "next/navigation";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getShellData } from "@/modules/shell/lib/shell-data";

/**
 * Guard for every organization section except billing. The billing role is a finance seat: it reaches
 * billing and its own account, so anything else sends it to billing.
 *
 * `organization.read_access` is the set of every membership role except billing (see the note on
 * `redirectBillingRoleFromRestrictedOrgSettings`, which this replaces), and `getShellData` has already
 * 404ed a caller with no membership at all.
 */
export const requireNonBillingRole = async (organizationId: string) => {
  const shell = await getShellData(organizationId);

  const hasReadAccess = await withAuthorizationSurface("page", () =>
    can({ type: "user", id: shell.user.id }, "organization.read_access", {
      type: "organization",
      id: organizationId,
    })
  );

  // Outside the surface callback: `redirect()` throws a Next control-flow error.
  if (!hasReadAccess) {
    redirect(`/organizations/${organizationId}/billing`);
  }

  return shell;
};
