import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FORMBRICKS_ORGANIZATION_ID_COOKIE } from "@/lib/localStorage";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { getSession } from "@/modules/auth/lib/session";

/**
 * The organization a signed-in user lands in: the one they last visited if they still belong to it,
 * otherwise the first. `null` when they belong to none.
 */
export const getActiveOrganizationId = async (): Promise<string | null> => {
  const session = await getSession();
  if (!session) {
    return redirect("/auth/login");
  }

  const organizations = await getOrganizationsByUserId(session.user.id);
  if (organizations.length === 0) {
    return null;
  }

  const lastId = (await cookies()).get(FORMBRICKS_ORGANIZATION_ID_COOKIE)?.value;
  return organizations.find((organization) => organization.id === lastId)?.id ?? organizations[0].id;
};
