import { EnvironmentLayout } from "@/app/(app)/environments/[environmentId]/components/EnvironmentLayout";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { ToasterClient } from "@/modules/ui/components/toaster-client";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { IS_POSTHOG_CONFIGURED } from "@formbricks/lib/constants";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getUser } from "@formbricks/lib/user/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { FormbricksClient } from "../../components/FormbricksClient";
import EnvironmentStorageHandler from "./components/EnvironmentStorageHandler";
import { PosthogIdentify } from "./components/PosthogIdentify";

const EnvLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const t = await getTranslate();
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const user = await getUser(session.user.id);
  if (!user) {
    return redirect(`/auth/login`);
  }

  const hasAccess = await hasUserEnvironmentAccess(session.user.id, params.environmentId);
  if (!hasAccess) {
    throw new AuthorizationError(t("common.not_authorized"));
  }

  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }
  const project = await getProjectByEnvironmentId(params.environmentId);
  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);

  if (!membership) {
    throw new Error(t("common.membership_not_found"));
  }

  return (
    <ResponseFilterProvider>
      <PosthogIdentify
        session={session}
        user={user}
        environmentId={params.environmentId}
        organizationId={organization.id}
        organizationName={organization.name}
        organizationBilling={organization.billing}
        isPosthogEnabled={IS_POSTHOG_CONFIGURED}
      />
      <FormbricksClient userId={user.id} email={user.email} />
      <ToasterClient />
      <EnvironmentStorageHandler environmentId={params.environmentId} />
      <EnvironmentLayout environmentId={params.environmentId} session={session}>
        {children}
      </EnvironmentLayout>
    </ResponseFilterProvider>
  );
};

export default EnvLayout;
