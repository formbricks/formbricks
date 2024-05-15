import { FormbricksClient } from "@/app/(app)/components/FormbricksClient";
import { PosthogIdentify } from "@/app/(app)/environments/[environmentId]/components/PosthogIdentify";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { DevEnvironmentBanner } from "@formbricks/ui/DevEnvironmentBanner";
import { ToasterClient } from "@formbricks/ui/ToasterClient";

const EnvLayout = async ({ children, params }) => {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }
  const hasAccess = await hasUserEnvironmentAccess(session.user.id, params.environmentId);
  if (!hasAccess) {
    throw new AuthorizationError("Not authorized");
  }

  const team = await getTeamByEnvironmentId(params.environmentId);
  if (!team) {
    throw new Error("Team not found");
  }

  const environment = await getEnvironment(params.environmentId);

  if (!environment) {
    throw new Error("Environment not found");
  }

  return (
    <>
      <ResponseFilterProvider>
        <PosthogIdentify
          session={session}
          environmentId={params.environmentId}
          teamId={team.id}
          teamName={team.name}
          inAppSurveyBillingStatus={team.billing.features.inAppSurvey.status}
          linkSurveyBillingStatus={team.billing.features.linkSurvey.status}
          userTargetingBillingStatus={team.billing.features.userTargeting.status}
        />
        <FormbricksClient session={session} />
        <ToasterClient />
        <div className="flex h-screen flex-col">
          <DevEnvironmentBanner environment={environment} />
          <div className="h-full overflow-y-auto bg-slate-50">{children}</div>
        </div>
      </ResponseFilterProvider>
    </>
  );
};

export default EnvLayout;
