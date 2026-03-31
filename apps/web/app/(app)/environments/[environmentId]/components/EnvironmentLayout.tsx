import { MainNavigation } from "@/app/(app)/environments/[environmentId]/components/MainNavigation";
import { TopControlBar } from "@/app/(app)/environments/[environmentId]/components/TopControlBar";
import { IS_DEVELOPMENT, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getAccessFlags } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { getOrganizationWorkspacesLimit } from "@/modules/ee/license-check/lib/utils";
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
    workspace, // Current workspace details
    environments, // All workspace environments (for environment switcher)
    isAccessControlAllowed,
    workspacePermission,
    license,
    responseCount,
  } = layoutData;

  // Calculate derived values (no queries)
  const { isMember, isOwner, isManager } = getAccessFlags(membership.role);

  const { features, lastChecked, isPendingDowngrade, active, status } = license;
  const isMultiOrgEnabled = features?.isMultiOrgEnabled ?? false;
  const organizationWorkspacesLimit = await getOrganizationWorkspacesLimit(organization.id);
  const isOwnerOrManager = isOwner || isManager;

  // Validate that workspace permission exists for members
  if (isMember && !workspacePermission) {
    throw new Error(t("common.workspace_permission_not_found"));
  }

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden">
      {IS_FORMBRICKS_CLOUD && (
        <LimitsReachedBanner
          organization={organization}
          environmentId={environment.id}
          responseCount={responseCount}
        />
      )}

      <PendingDowngradeBanner
        lastChecked={lastChecked}
        isPendingDowngrade={isPendingDowngrade ?? false}
        active={active}
        environmentId={environment.id}
        locale={user.locale}
        status={status}
      />

      <div className="flex h-full">
        <MainNavigation
          environment={environment}
          organization={organization}
          user={user}
          workspace={{ id: workspace.id, name: workspace.name }}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          isDevelopment={IS_DEVELOPMENT}
          membershipRole={membership.role}
          publicDomain={publicDomain}
        />
        <div id="mainContent" className="flex flex-1 flex-col overflow-hidden bg-slate-50">
          <TopControlBar
            environments={environments}
            currentOrganizationId={organization.id}
            currentWorkspaceId={workspace.id}
            isMultiOrgEnabled={isMultiOrgEnabled}
            organizationWorkspacesLimit={organizationWorkspacesLimit}
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
