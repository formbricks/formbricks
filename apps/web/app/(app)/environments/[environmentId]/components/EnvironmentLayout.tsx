import { MainNavigation } from "@/app/(app)/environments/[environmentId]/components/MainNavigation";
import { TopControlBar } from "@/app/(app)/environments/[environmentId]/components/TopControlBar";
import type { Session } from "next-auth";
import { getEnterpriseLicense, getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
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
import { DevEnvironmentBanner } from "@formbricks/ui/DevEnvironmentBanner";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import { LimitsReachedBanner } from "@formbricks/ui/LimitsReachedBanner";

interface EnvironmentLayoutProps {
  environmentId: string;
  session: Session;
  children?: React.ReactNode;
}

export const EnvironmentLayout = async ({ environmentId, session, children }: EnvironmentLayoutProps) => {
  const [environment, organizations, organization] = await Promise.all([
    getEnvironment(environmentId),
    getOrganizationsByUserId(session.user.id),
    getOrganizationByEnvironmentId(environmentId),
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
  // const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  // const isMultiOrgEnabled = true;
  const { features, message: licenseErrorMessage } = await getEnterpriseLicense();
  console.log({ features, licenseErrorMessage });

  const isMultiOrgEnabled = features?.isMultiOrgEnabled ?? false;

  const currentProductChannel =
    products.find((product) => product.id === environment.productId)?.config.channel ?? null;

  const [peopleCount, responseCount] = await Promise.all([
    getMonthlyActiveOrganizationPeopleCount(organization.id),
    getMonthlyOrganizationResponseCount(organization.id),
  ]);

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden">
      <DevEnvironmentBanner environment={environment} />

      {IS_FORMBRICKS_CLOUD && (
        <LimitsReachedBanner
          organization={organization}
          peopleCount={peopleCount}
          responseCount={responseCount}
        />
      )}

      {licenseErrorMessage && <div className="bg-red-500 p-4 text-white">{licenseErrorMessage}</div>}

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
          <TopControlBar
            environment={environment}
            environments={environments}
            currentProductChannel={currentProductChannel}
          />
          <div className="mt-14">{children}</div>
        </div>
      </div>
    </div>
  );
};
