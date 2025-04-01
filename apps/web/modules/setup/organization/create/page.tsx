import { authOptions } from "@/modules/auth/lib/authOptions";
import { RemovedFromOrganization } from "@/modules/setup/organization/create/components/removed-from-organization";
import { ClientLogout } from "@/modules/ui/components/client-logout";
import { getTranslate } from "@/tolgee/server";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { gethasNoOrganizations } from "@formbricks/lib/instance/service";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { AuthenticationError } from "@formbricks/types/errors";
import { CreateOrganization } from "./components/create-organization";

export const metadata: Metadata = {
  title: "Create Organization",
  description: "Open-source Experience Management. Free & open source.",
};

export const CreateOrganizationPage = async () => {
  const t = await getTranslate();
  const session = await getServerSession(authOptions);

  if (!session) throw new AuthenticationError(t("common.session_not_found"));

  const user = await getUser(session.user.id);
  if (!user) {
    return <ClientLogout />;
  }

  const hasNoOrganizations = await gethasNoOrganizations();
  const isMultiOrgEnabled = false;
  const userOrganizations = await getOrganizationsByUserId(session.user.id);

  if (hasNoOrganizations || isMultiOrgEnabled) {
    return <CreateOrganization />;
  }

  if (userOrganizations.length === 0) {
    return <RemovedFromOrganization user={user} isFormbricksCloud={IS_FORMBRICKS_CLOUD} />;
  }

  return notFound();
};
