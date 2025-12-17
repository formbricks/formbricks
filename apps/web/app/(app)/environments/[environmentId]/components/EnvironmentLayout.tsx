import { MainNavigation } from "@/app/(app)/environments/[environmentId]/components/MainNavigation";
import { TopControlBar } from "@/app/(app)/environments/[environmentId]/components/TopControlBar";
import { IS_DEVELOPMENT, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getAccessFlags } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { getOrganizationProjectsLimit } from "@/modules/ee/license-check/lib/utils";
import { TEnvironmentLayoutData } from "@/modules/environments/types/environment-auth";
import { LimitsReachedBanner } from "@/modules/ui/components/limits-reached-banner";
import { PendingDowngradeBanner } from "@/modules/ui/components/pending-downgrade-banner";

interface EnvironmentLayoutProps {
  layoutData: TEnvironmentLayoutData;
  children?: React.ReactNode;
}

export const EnvironmentLayout = async ({ layoutData, children }: EnvironmentLayoutProps) => {
  const t = await getTranslate();
  const publicDomain = getPublicDomain();

  // Destructure all data from props (NO database queries)
  const {
    user,
    environment,
    organization,
    membership,
    project, // Current project details
    environments, // All project environments (for environment switcher)
    isAccessControlAllowed,
    projectPermission,
    license,
    peopleCount,
    responseCount,
  } = layoutData;

  // Calculate derived values (no queries)
  const { isMember, isOwner, isManager } = getAccessFlags(membership.role);

  const { features, lastChecked, isPendingDowngrade, active } = license;
  const isMultiOrgEnabled = features?.isMultiOrgEnabled ?? false;
  const organizationProjectsLimit = await getOrganizationProjectsLimit(organization.billing.limits);
  const isOwnerOrManager = isOwner || isManager;

  // Validate that project permission exists for members
  if (isMember && !projectPermission) {
    throw new Error(t("common.project_permission_not_found"));
  }

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden">
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
        locale={user.locale}
      />

      <div className="flex h-full">
        <MainNavigation
          environment={environment}
          organization={organization}
          user={user}
          project={{ id: project.id, name: project.name }}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          isDevelopment={IS_DEVELOPMENT}
          membershipRole={membership.role}
          publicDomain={publicDomain}
        />
        <div id="mainContent" className="flex flex-1 flex-col overflow-hidden bg-slate-50">
          <TopControlBar
            environments={environments}
            currentOrganizationId={organization.id}
            currentProjectId={project.id}
            isMultiOrgEnabled={isMultiOrgEnabled}
            organizationProjectsLimit={organizationProjectsLimit}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
            isLicenseActive={active}
            isOwnerOrManager={isOwnerOrManager}
            isAccessControlAllowed={isAccessControlAllowed}
            membershipRole={membership.role}
          />
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
};
