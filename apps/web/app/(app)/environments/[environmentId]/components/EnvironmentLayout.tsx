import { MainNavigation } from "@/app/(app)/environments/[environmentId]/components/MainNavigation";
import { TopControlBar } from "@/app/(app)/environments/[environmentId]/components/TopControlBar";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/utils";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { DevEnvironmentBanner } from "@/modules/ui/components/dev-environment-banner";
import { LimitsReachedBanner } from "@/modules/ui/components/limits-reached-banner";
import { PendingDowngradeBanner } from "@/modules/ui/components/pending-downgrade-banner";
import type { Session } from "next-auth";
import { getTranslations } from "next-intl/server";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
  getOrganizationsByUserId,
} from "@formbricks/lib/organization/service";
import { getUserProducts } from "@formbricks/lib/product/service";
import { getUser } from "@formbricks/lib/user/service";

interface EnvironmentLayoutProps {
  environmentId: string;
  session: Session;
  children?: React.ReactNode;
}

export const EnvironmentLayout = async ({ environmentId, session, children }: EnvironmentLayoutProps) => {
  const t = await getTranslations();
  const [user, environment, organizations, organization] = await Promise.all([
    getUser(session.user.id),
    getEnvironment(environmentId),
    getOrganizationsByUserId(session.user.id),
    getOrganizationByEnvironmentId(environmentId),
  ]);

  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  const [products, environments] = await Promise.all([
    getUserProducts(user.id, organization.id),
    getEnvironments(environment.productId),
  ]);

  if (!products || !environments || !organizations) {
    throw new Error(t("environments.products_environments_organizations_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const membershipRole = currentUserMembership?.role;
  const { isMember } = getAccessFlags(membershipRole);

  const { features, lastChecked, isPendingDowngrade, active } = await getEnterpriseLicense();

  const productPermission = await getProductPermissionByUserId(session.user.id, environment.productId);

  if (isMember && !productPermission) {
    throw new Error(t("common.product_permission_not_found"));
  }

  const isMultiOrgEnabled = features?.isMultiOrgEnabled ?? false;
  const isContactsEnabled = features?.contacts ?? false;

  let peopleCount = 0;
  let responseCount = 0;

  if (IS_FORMBRICKS_CLOUD) {
    [peopleCount, responseCount] = await Promise.all([
      getMonthlyActiveOrganizationPeopleCount(organization.id),
      getMonthlyOrganizationResponseCount(organization.id),
    ]);
  }

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
          membershipRole={membershipRole}
          isMultiOrgEnabled={isMultiOrgEnabled}
          isContactsEnabled={isContactsEnabled}
        />
        <div id="mainContent" className="flex-1 overflow-y-auto bg-slate-50">
          <TopControlBar
            environment={environment}
            environments={environments}
            membershipRole={membershipRole}
            productPermission={productPermission}
          />
          <div className="mt-14">{children}</div>
        </div>
      </div>
    </div>
  );
};
