import { Metadata } from "next";
import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getUser } from "@/lib/user/service";
import { requiresPasswordConfirmationForAccountDeletion } from "@/modules/account/lib/account-deletion-auth";
import { AuthCard } from "@/modules/auth/components/auth-card";
import { AuthPage } from "@/modules/auth/components/form-wrapper";
import { getSession } from "@/modules/auth/lib/session";
import { NoOrganizationCard } from "@/modules/shell/account/components/no-organization-card";
import { getActiveOrganizationId } from "@/modules/shell/lib/active-organization";
import { ClientLogout } from "@/modules/ui/components/client-logout";

export const metadata: Metadata = {
  title: "No organization",
};

/**
 * Where a signed-in person with no organization lands (they were removed from their only one). Sign-up
 * creates an organization for everyone who is not invited, so this is the exception, and the only thing
 * left to do is delete the account or be invited again. Outside the shell chrome, which needs an
 * organization to link to.
 */
const NoOrganizationPage = async () => {
  const session = await getSession();
  if (!session?.user) {
    return redirect("/auth/login");
  }

  const user = await getUser(session.user.id);
  if (!user) {
    return <ClientLogout />;
  }

  // Invited back in the meantime: nothing to explain.
  const organizationId = await getActiveOrganizationId();
  if (organizationId) {
    return redirect(`/organizations/${organizationId}`);
  }

  return (
    <AuthPage>
      <AuthCard width="wide">
        <NoOrganizationCard
          user={user}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          requiresPasswordConfirmation={requiresPasswordConfirmationForAccountDeletion(user)}
        />
      </AuthCard>
    </AuthPage>
  );
};

export default NoOrganizationPage;
