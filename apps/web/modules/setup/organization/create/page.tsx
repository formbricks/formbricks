import { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthenticationError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, USER_MANAGEMENT_MINIMUM_ROLE } from "@/lib/constants";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { requiresPasswordConfirmationForAccountDeletion } from "@/modules/account/lib/account-deletion-auth";
import { getSession } from "@/modules/auth/lib/session";
import { RemovedFromOrganization } from "@/modules/setup/organization/create/components/removed-from-organization";
import { resolveSetupOrganizationCreation } from "@/modules/setup/organization/lib/setup-organization-policy";
import { ClientLogout } from "@/modules/ui/components/client-logout";
import { CreateOrganization } from "./components/create-organization";

export const metadata: Metadata = {
  title: "Create Organization",
  description: "Open-source Experience Management. Free & open source.",
};

export const CreateOrganizationPage = async () => {
  const t = await getTranslate();
  const session = await getSession();

  if (!session) throw new AuthenticationError(t("common.session_not_found"));

  const user = await getUser(session.user.id);
  if (!user) {
    return <ClientLogout />;
  }

  const [creation, userOrganizations] = await Promise.all([
    // ENG-7313: the rule `POST /api/internal/organizations` enforces, so the form is offered exactly where
    // the route accepts it.
    resolveSetupOrganizationCreation(user.id),
    getOrganizationsByUserId(session.user.id),
  ]);

  if (creation.allowed) {
    // The organization does not exist yet, so the floor cannot be asked of it; its creator becomes an
    // owner, whom every floor but `disabled` admits.
    return <CreateOrganization skipInviteStep={USER_MANAGEMENT_MINIMUM_ROLE === "disabled"} />;
  }

  if (userOrganizations.length === 0) {
    return (
      <RemovedFromOrganization
        user={user}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        requiresPasswordConfirmation={requiresPasswordConfirmationForAccountDeletion(user)}
      />
    );
  }

  return notFound();
};
