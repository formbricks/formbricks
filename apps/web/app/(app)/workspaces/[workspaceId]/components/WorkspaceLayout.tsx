import { cookies } from "next/headers";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { MainNavigation } from "@/app/(app)/workspaces/[workspaceId]/components/MainNavigation";
import { TopControlBar } from "@/app/(app)/workspaces/[workspaceId]/components/TopControlBar";
import { IS_DEVELOPMENT, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getAccessFlags } from "@/lib/membership/utils";
import { getPostHogFeatureFlag } from "@/lib/posthog/get-feature-flag";
import { getTranslate } from "@/lingodotdev/server";
import { TrialEndingWarningModal } from "@/modules/ee/billing/components/trial-ending-warning-modal";
import { TrialResponseWarningModal } from "@/modules/ee/billing/components/trial-response-warning-modal";
import { getOrganizationWorkspacesLimit } from "@/modules/ee/license-check/lib/utils";
import { LimitsReachedBanner } from "@/modules/ui/components/limits-reached-banner";
import { PendingDowngradeBanner } from "@/modules/ui/components/pending-downgrade-banner";
import { TWorkspaceLayoutData } from "@/modules/workspaces/types/workspace-auth";

interface WorkspaceLayoutProps {
  layoutData: TWorkspaceLayoutData;
  children?: React.ReactNode;
}

export const WorkspaceLayout = async ({ layoutData, children }: WorkspaceLayoutProps) => {
  const t = await getTranslate();
  const publicDomain = getPublicDomain();

  // Destructure all data from props (NO database queries)
  const {
    user,
    organization,
    membership,
    workspace, // Current workspace details
    isAccessControlAllowed,
    workspacePermission,
    license,
    responseCount,
  } = layoutData;

  // Calculate derived values (no queries)
  const { isMember, isOwner, isManager } = getAccessFlags(membership.role);

  const { features, lastChecked, isPendingDowngrade, active, status } = license;
  const isMultiOrgEnabled = features?.isMultiOrgEnabled ?? false;
  const isTrialing = IS_FORMBRICKS_CLOUD && organization.billing?.stripe?.subscriptionStatus === "trialing";

  const [
    organizationWorkspacesLimit,
    newTrialBannerVariant,
    trialWarningVariant,
    trialEndingVariant,
    cookieStore,
  ] = await Promise.all([
    getOrganizationWorkspacesLimit(organization.id),
    getPostHogFeatureFlag(user.id, "a-b_navigation_rich-trial-banner"),
    isTrialing
      ? getPostHogFeatureFlag(user.id, "a-b_workspace_trial-response-warning")
      : Promise.resolve(null),
    isTrialing ? getPostHogFeatureFlag(user.id, "a-b_workspace_trial-ending-warning") : Promise.resolve(null),
    isTrialing ? cookies() : Promise.resolve(null),
  ]);

  const isOwnerOrManager = isOwner || isManager;

  // Validate that workspace permission exists for members
  if (isMember && !workspacePermission) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  const showTrialResponseInfo =
    isTrialing &&
    trialWarningVariant === "test" &&
    !!cookieStore &&
    responseCount >= 250 &&
    !cookieStore.get("trial_warning_shown_250");

  // Show the loss-aversion trial-ending modal once on each of the last 3 days of the trial.
  // Don't stack it on top of the response-threshold modal if both fire on the same load.
  const MS_PER_DAY = 86_400_000;
  const trialEnd = organization.billing?.stripe?.trialEnd;
  let trialEndingDaysRemaining: number | null = null;
  if (isTrialing && trialEndingVariant === "test" && cookieStore && trialEnd && !showTrialResponseInfo) {
    const trialEndTime = new Date(trialEnd).getTime();
    if (Number.isFinite(trialEndTime)) {
      const daysRemaining = Math.ceil((trialEndTime - Date.now()) / MS_PER_DAY);
      if (
        daysRemaining >= 1 &&
        daysRemaining <= 3 &&
        !cookieStore.get(`trial_ending_shown_${daysRemaining}`)
      ) {
        trialEndingDaysRemaining = daysRemaining;
      }
    }
  }

  const billingHref = `/workspaces/${workspace.id}/settings/organization/billing`;

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden">
      {IS_FORMBRICKS_CLOUD && !isTrialing && (
        <LimitsReachedBanner organization={organization} responseCount={responseCount} />
      )}

      <PendingDowngradeBanner
        lastChecked={lastChecked}
        isPendingDowngrade={isPendingDowngrade ?? false}
        active={active}
        locale={user.locale}
        status={status}
      />

      {showTrialResponseInfo && (
        <TrialResponseWarningModal billingHref={billingHref} responseCount={responseCount} />
      )}

      {trialEndingDaysRemaining && (
        <TrialEndingWarningModal daysRemaining={trialEndingDaysRemaining} billingHref={billingHref} />
      )}

      <div className="flex h-full">
        <MainNavigation
          organization={organization}
          user={user}
          workspace={{ id: workspace.id, name: workspace.name }}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          isDevelopment={IS_DEVELOPMENT}
          membershipRole={membership.role}
          publicDomain={publicDomain}
          organizationWorkspacesLimit={organizationWorkspacesLimit}
          isLicenseActive={active}
          isAccessControlAllowed={isAccessControlAllowed}
          responseCount={responseCount}
          newTrialBannerVariant={newTrialBannerVariant}
        />
        <div id="mainContent" className="flex flex-1 flex-col overflow-hidden bg-slate-50">
          <TopControlBar
            currentOrganizationId={organization.id}
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
