import VerticalNavigation from "@/app/(app)/environments/[environmentId]/components/VerticalNavigation";
import FBLogo from "@/images/Formbricks-wordmark.svg";
import type { Session } from "next-auth";
import Image from "next/image";
import Link from "next/link";

import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getProducts } from "@formbricks/lib/product/service";
import { getTeamByEnvironmentId, getTeamsByUserId } from "@formbricks/lib/team/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

interface EnvironmentsNavbarProps {
  environmentId: string;
  session: Session;
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

  const isMultiLanguageAllowed = getMultiLanguagePermission(team);

  const [products, environments] = await Promise.all([
    getProducts(team.id),
    getEnvironments(environment.productId),
  ]);

  if (!products || !environments || !teams) {
    return <ErrorComponent />;
  }
  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);

  return (
    <div className="fixed top-1/2 z-10 flex h-screen w-64 -translate-y-1/2 flex-col justify-between">
      <Link href={`/environments/${environment.id}/surveys/`} className="p-2">
        <Image src={FBLogo} width={200} height={30} alt="Formbricks wordmark" />
      </Link>
      <VerticalNavigation
        environment={environment}
        team={team}
        teams={teams}
        products={products}
        environments={environments}
        session={session}
        isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        webAppUrl={WEBAPP_URL}
        membershipRole={currentUserMembership?.role}
        isMultiLanguageAllowed={isMultiLanguageAllowed}
      />
      <div className="h-[50px]"></div>
    </div>
  );
}
