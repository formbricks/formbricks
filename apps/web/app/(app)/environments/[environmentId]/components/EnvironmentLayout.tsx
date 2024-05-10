import { MainNavigation } from "@/app/(app)/environments/[environmentId]/components/MainNavigation";
import { TopControlBar } from "@/app/(app)/environments/[environmentId]/components/TopControlBar";
import type { Session } from "next-auth";

import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getProducts } from "@formbricks/lib/product/service";
import { getTeamByEnvironmentId, getTeamsByUserId } from "@formbricks/lib/team/service";
import { DevEnvironmentBanner } from "@formbricks/ui/DevEnvironmentBanner";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

interface EnvironmentLayoutProps {
  environmentId: string;
  session: Session;
  children?: React.ReactNode;
}

export const EnvironmentLayout = async ({ environmentId, session, children }: EnvironmentLayoutProps) => {
  const [environment, teams, team] = await Promise.all([
    getEnvironment(environmentId),
    getTeamsByUserId(session.user.id),
    getTeamByEnvironmentId(environmentId),
  ]);

  if (!team || !environment) {
    return <ErrorComponent />;
  }

  const [products, environments] = await Promise.all([
    getProducts(team.id),
    getEnvironments(environment.productId),
  ]);

  if (!products || !environments || !teams) {
    return <ErrorComponent />;
  }
  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden">
      <DevEnvironmentBanner environment={environment} />
      <div className="flex h-full">
        <MainNavigation
          environment={environment}
          team={team}
          teams={teams}
          products={products}
          session={session}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
        />
        <div id="mainContent" className="flex-1 overflow-y-auto bg-slate-50">
          <TopControlBar environment={environment} environments={environments} />
          <div className="mt-14">{children}</div>
        </div>
      </div>
    </div>
  );
};
