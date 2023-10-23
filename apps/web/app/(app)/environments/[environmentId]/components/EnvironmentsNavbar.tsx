export const revalidate = REVALIDATION_INTERVAL;

import Navigation from "@/app/(app)/environments/[environmentId]/components/Navigation";
import { IS_FORMBRICKS_CLOUD, REVALIDATION_INTERVAL, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getProducts } from "@formbricks/lib/product/service";
import { getTeamByEnvironmentId, getTeamsByUserId } from "@formbricks/lib/team/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import type { Session } from "next-auth";

interface EnvironmentsNavbarProps {
  environmentId: string;
  session: Session;
  isFormbricksCloud: boolean;
}

export default async function EnvironmentsNavbar({ environmentId, session }: EnvironmentsNavbarProps) {
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
  const isPricingDisabled =
    currentUserMembership?.role !== "owner" ? currentUserMembership?.role !== "admin" : false;

  return (
    <Navigation
      environment={environment}
      team={team}
      teams={teams}
      products={products}
      environments={environments}
      session={session}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      webAppUrl={WEBAPP_URL}
      surveyBaseUrl={SURVEY_BASE_URL}
      isPricingDisabled={isPricingDisabled}
    />
  );
}
