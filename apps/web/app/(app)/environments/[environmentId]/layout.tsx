import { EnvironmentLayout } from "@/app/(app)/environments/[environmentId]/components/EnvironmentLayout";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { environmentIdLayoutChecks } from "@/modules/environments/lib/utils";
import { ToasterClient } from "@/modules/ui/components/toaster-client";
import { redirect } from "next/navigation";
import {
  FORMBRICKS_API_HOST,
  FORMBRICKS_ENVIRONMENT_ID,
  IS_FORMBRICKS_ENABLED,
  IS_POSTHOG_CONFIGURED,
} from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { FormbricksClient } from "../../components/FormbricksClient";
import EnvironmentStorageHandler from "./components/EnvironmentStorageHandler";
import { PosthogIdentify } from "./components/PosthogIdentify";

const EnvLayout = async (props: {
  params: Promise<{ environmentId: string }>;
  children: React.ReactNode;
}) => {
  const params = await props.params;

  const { children } = props;

  const { t, session, user, organization } = await environmentIdLayoutChecks(params.environmentId);

  if (!user) {
    redirect(`/auth/login`);
  }

  console.log("t", t);

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
      <FormbricksClient
        userId={user.id}
        email={user.email}
        formbricksApiHost={FORMBRICKS_API_HOST}
        formbricksEnvironmentId={FORMBRICKS_ENVIRONMENT_ID}
        formbricksEnabled={IS_FORMBRICKS_ENABLED}
      />
      <ToasterClient />
      <EnvironmentStorageHandler environmentId={params.environmentId} />
      <EnvironmentLayout environmentId={params.environmentId} session={session}>
        {children}
      </EnvironmentLayout>
    </ResponseFilterProvider>
  );
};

export default EnvLayout;
