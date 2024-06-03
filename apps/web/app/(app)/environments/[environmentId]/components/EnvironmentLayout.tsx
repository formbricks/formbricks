import { MainNavigation } from "@/app/(app)/environments/[environmentId]/components/MainNavigation";
import { TopControlBar } from "@/app/(app)/environments/[environmentId]/components/TopControlBar";
import type { Session } from "next-auth";

import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import {
  getOrganizationByEnvironmentId,
  getOrganizationsByUserId,
} from "@formbricks/lib/organization/service";
import { getProducts } from "@formbricks/lib/product/service";
import { DevEnvironmentBanner } from "@formbricks/ui/DevEnvironmentBanner";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

interface EnvironmentLayoutProps {
  environmentId: string;
  session: Session;
  children?: React.ReactNode;
}

export const EnvironmentLayout = async ({ environmentId, session, children }: EnvironmentLayoutProps) => {
  const [environment, organizations, organization, isMultiOrgEnabled] = await Promise.all([
    getEnvironment(environmentId),
    getOrganizationsByUserId(session.user.id),
    getOrganizationByEnvironmentId(environmentId),
    getIsMultiOrgEnabled(),
  ]);

  if (!organization || !environment) {
    return <ErrorComponent />;
  }

  const [products, environments] = await Promise.all([
    getProducts(organization.id),
    getEnvironments(environment.productId),
  ]);

  if (!products || !environments || !organizations) {
    return <ErrorComponent />;
  }
  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden">
      <DevEnvironmentBanner environment={environment} />
      <div className="flex h-full">
        <MainNavigation
          environment={environment}
          organization={organization}
          organizations={organizations}
          products={products}
          session={session}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          isMultiOrgEnabled={isMultiOrgEnabled}
        />
        <div id="mainContent" className="flex-1 overflow-y-auto bg-slate-50">
          <TopControlBar environment={environment} environments={environments} />
          <div className="mt-14">{children}</div>
        </div>
      </div>
    </div>
  );
};
