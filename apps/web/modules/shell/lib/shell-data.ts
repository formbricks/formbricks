import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache as reactCache } from "react";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getSession } from "@/modules/auth/lib/session";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";

/**
 * Everything the account shell needs to render its chrome. The shell is the only human UI left, so
 * this is the single place that decides who may see it: no session goes to login, a user without a
 * membership in the organization gets a 404 (via `getOrganizationAuth`).
 */
export const getShellData = reactCache(async (organizationId: string) => {
  const session = await getSession();
  if (!session) {
    return redirect("/auth/login");
  }

  const [auth, user, organizations] = await Promise.all([
    getOrganizationAuth(organizationId),
    getUser(session.user.id),
    getOrganizationsByUserId(session.user.id),
  ]);

  if (!user) {
    return notFound();
  }

  return {
    user: { id: user.id, name: user.name, email: user.email },
    organization: auth.organization,
    organizations: organizations.map(({ id, name }) => ({ id, name })),
    membership: auth.currentUserMembership,
    isOwner: auth.isOwner,
    isManager: auth.isManager,
    isBilling: auth.isBilling,
  };
});
