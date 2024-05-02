import TopControls from "@/app/(app)/environments/[environmentId]/components/TopControls";
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
import { ContentWrapper } from "@formbricks/ui/ContentWrapper";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

interface EnvironmentLayoutProps {
  environmentId: string;
  session: Session;
  children?: React.ReactNode;
}

export default async function EnvironmentLayout({
  environmentId,
  session,
  children,
}: EnvironmentLayoutProps) {
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
    <div id="frame" className="h-full overflow-hidden bg-slate-50">
      <div id="topBar" className="flex justify-between">
        <Link href={`/environments/${environment.id}/surveys/`} className="h-12 p-2">
          <Image src={FBLogo} width={180} height={30} alt="Formbricks wordmark" />
        </Link>
        <TopControls environment={environment} />
      </div>
      <div id="sideNav and content" className="flex h-full">
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
        <ContentWrapper>{children}</ContentWrapper>
      </div>
    </div>
  );
}
