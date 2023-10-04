export const revalidate = REVALIDATION_INTERVAL;

import Navigation from "@/app/(app)/environments/[environmentId]/Navigation";
import { IS_FORMBRICKS_CLOUD, REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getProducts } from "@formbricks/lib/product/service";
import { getTeamByEnvironmentId, getTeamsByUserId } from "@formbricks/lib/team/service";
import { ErrorComponent } from "@formbricks/ui";
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

  return (
    <Navigation
      environment={environment}
      team={team}
      teams={teams}
      products={products}
      environments={environments}
      session={session}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
    />
  );
}
