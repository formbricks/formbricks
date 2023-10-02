export const revalidate = REVALIDATION_INTERVAL;

import Navigation from "@/app/(app)/environments/[environmentId]/Navigation";
import { IS_FORMBRICKS_CLOUD, REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/services/environment";
import { getProducts } from "@formbricks/lib/services/product";
import { getTeamByEnvironmentId, getTeamsByUserId } from "@formbricks/lib/services/team";
import { ErrorComponent } from "@formbricks/ui";
import type { Session } from "next-auth";
import { SURVEY_BASE_URL } from "@formbricks/lib/constants";

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

  return (
    <Navigation
      environment={environment}
      team={team}
      teams={teams}
      products={products}
      environments={environments}
      session={session}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      surveyBaseUrl={SURVEY_BASE_URL}
    />
  );
}
