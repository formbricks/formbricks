import EnvironmentsNavbar from "@/app/(app)/environments/[environmentId]/components/EnvironmentsNavbar";
import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { AuthorizationError } from "@formbricks/types/errors";
import ToasterClient from "@formbricks/ui/ToasterClient";

import FormbricksClient from "../../components/FormbricksClient";
import PosthogIdentify from "./components/PosthogIdentify";

export default async function EnvironmentLayout({ children, params }) {
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
        <EnvironmentsNavbar environmentId={params.environmentId} session={session} />
        <main className="h-full flex-1 overflow-y-auto bg-slate-50">
          {children}
          <main />
        </main>
      </ResponseFilterProvider>
    </>
  );
}
