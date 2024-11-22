import { RemovedFromOrganization } from "@/app/setup/organization/create/components/RemovedFromOrganization";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { ClientLogout } from "@/modules/ui/components/client-logout";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { gethasNoOrganizations } from "@formbricks/lib/instance/service";
import { getOrganizationsByUserId } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { AuthenticationError } from "@formbricks/types/errors";
import { CreateOrganization } from "./components/CreateOrganization";

export const metadata: Metadata = {
  title: "Create Organization",
  description: "Open-source Experience Management. Free & open source.",
};

const Page = async () => {
  const t = await getTranslations();
  const session = await getServerSession(authOptions);

  if (!session) throw new AuthenticationError(t("common.session_not_found"));

  const user = await getUser(session.user.id);
  if (!user) {
    return <ClientLogout />;
  }

  const hasNoOrganizations = await gethasNoOrganizations();
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  const userOrganizations = await getOrganizationsByUserId(session.user.id);

  if (hasNoOrganizations || isMultiOrgEnabled) {
    return <CreateOrganization />;
  }

  if (!hasNoOrganizations && userOrganizations.length === 0 && !isMultiOrgEnabled) {
    return <RemovedFromOrganization user={user} isFormbricksCloud={IS_FORMBRICKS_CLOUD} />;
  }

  return notFound();
};

export default Page;
