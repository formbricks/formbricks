import { MainNavigation } from "@/app/(app)/environments/[environmentId]/components/MainNavigation";
import { TopControlBar } from "@/app/(app)/environments/[environmentId]/components/TopControlBar";
import { getIsAIEnabled } from "@/app/lib/utils";
import type { Session } from "next-auth";
import { getEnterpriseLicense } from "@formbricks/ee/lib/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
  getOrganizationsByUserId,
} from "@formbricks/lib/organization/service";
import { getProducts } from "@formbricks/lib/product/service";
import { getUser } from "@formbricks/lib/user/service";
import { DevEnvironmentBanner } from "@formbricks/ui/components/DevEnvironmentBanner";
import { LimitsReachedBanner } from "@formbricks/ui/components/LimitsReachedBanner";
import { PendingDowngradeBanner } from "@formbricks/ui/components/PendingDowngradeBanner";

interface EnvironmentLayoutProps {
  environmentId: string;
  session: Session;
  children?: React.ReactNode;
}

export const EnvironmentLayout = async ({ environmentId, session, children }: EnvironmentLayoutProps) => {
  const [user, environment, organizations, organization] = await Promise.all([
    getUser(session.user.id),
    getEnvironment(environmentId),
    getOrganizationsByUserId(session.user.id),
    getOrganizationByEnvironmentId(environmentId),
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  if (!organization || !environment) {
    throw new Error("Organization or environment not found");
  }

  const [products, environments] = await Promise.all([
    getProducts(organization.id),
    getEnvironments(environment.productId),
  ]);

  if (!products || !environments || !organizations) {
    throw new Error("Products, environments or organizations not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { features, lastChecked, isPendingDowngrade, active } = await getEnterpriseLicense();

  const isMultiOrgEnabled = features?.isMultiOrgEnabled ?? false;

  let peopleCount = 0;
  let responseCount = 0;

  if (IS_FORMBRICKS_CLOUD) {
    [peopleCount, responseCount] = await Promise.all([
      getMonthlyActiveOrganizationPeopleCount(organization.id),
      getMonthlyOrganizationResponseCount(organization.id),
    ]);
  }

  const isAIEnabled = await getIsAIEnabled(organization);

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden">
      <DevEnvironmentBanner environment={environment} />

      {IS_FORMBRICKS_CLOUD && (
        <LimitsReachedBanner
          organization={organization}
          environmentId={environment.id}
          peopleCount={peopleCount}
          responseCount={responseCount}
        />
      )}

      <PendingDowngradeBanner
        lastChecked={lastChecked}
        isPendingDowngrade={isPendingDowngrade ?? false}
        active={active}
        environmentId={environment.id}
      />

      <div className="flex h-full">
        <MainNavigation
          environment={environment}
          organization={organization}
          organizations={organizations}
          products={products}
          user={user}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          isMultiOrgEnabled={isMultiOrgEnabled}
          isAIEnabled={isAIEnabled}
        />
        <div id="mainContent" className="flex-1 overflow-y-auto bg-slate-50">
          <TopControlBar
            environment={environment}
            environments={environments}
            membershipRole={currentUserMembership?.role}
          />
          <div className="mt-14">{children}</div>
        </div>
      </div>
    </div>
  );
};
