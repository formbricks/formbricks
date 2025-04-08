import { FormbricksClient } from "@/app/(app)/components/FormbricksClient";
import { PosthogIdentify } from "@/app/(app)/environments/[environmentId]/components/PosthogIdentify";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { environmentIdLayoutChecks } from "@/modules/environments/lib/utils";
import { DevEnvironmentBanner } from "@/modules/ui/components/dev-environment-banner";
import { ToasterClient } from "@/modules/ui/components/toaster-client";
import { redirect } from "next/navigation";
import {
  FORMBRICKS_API_HOST,
  FORMBRICKS_ENVIRONMENT_ID,
  IS_FORMBRICKS_ENABLED,
  IS_POSTHOG_CONFIGURED,
} from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";

const SurveyEditorEnvironmentLayout = async (props) => {
  const params = await props.params;

  const { children } = props;

  const { t, session, user, organization } = await environmentIdLayoutChecks(params.environmentId);

  if (!user) {
    redirect(`/auth/login`);
  }

  const environment = await getEnvironment(params.environmentId);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
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
      <div className="flex h-screen flex-col">
        <DevEnvironmentBanner environment={environment} />
        <div className="h-full overflow-y-auto bg-slate-50">{children}</div>
      </div>
    </ResponseFilterProvider>
  );
};

export default SurveyEditorEnvironmentLayout;
