import ClientEnvironmentRedirect from "@/app/ClientEnvironmentRedirect";
import { ClientLogout } from "@/modules/ui/components/client-logout";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getFirstEnvironmentIdByUserId } from "@formbricks/lib/environment/service";
import { getIsFreshInstance } from "@formbricks/lib/instance/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";

const Page = async () => {
  const t = await getTranslations();
  const session: Session | null = await getServerSession(authOptions);
  const isFreshInstance = await getIsFreshInstance();

  if (!session) {
    if (isFreshInstance) {
      redirect("/setup/intro");
    } else {
      redirect("/auth/login");
    }
  }

  if (!session?.user) {
    return <ClientLogout />;
  }

  const userOrganizations = await getOrganizationsByUserId(session.user.id);

  if (userOrganizations.length === 0) {
    return redirect("/setup/organization/create");
  }

  let environmentId: string | null = null;
  try {
    environmentId = await getFirstEnvironmentIdByUserId(session?.user.id);
  } catch (error) {
    console.error(`error getting environment: ${error}`);
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session?.user.id,
    userOrganizations[0].id
  );
  const { isManager, isOwner } = getAccessFlags(currentUserMembership?.role);

  if (!environmentId) {
    console.error(t("common.failed_to_get_first_environment_of_user"));
    if (isOwner || isManager) {
      return redirect(`/organizations/${userOrganizations[0].id}/products/new/mode`);
    } else {
      return redirect(`/organizations/${userOrganizations[0].id}/landing`);
    }
  }

  return <ClientEnvironmentRedirect environmentId={environmentId} />;
};

export default Page;
