import { cookies } from "next/headers";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { MainNavigation } from "@/app/(app)/workspaces/[workspaceId]/components/MainNavigation";
import { TopControlBar } from "@/app/(app)/workspaces/[workspaceId]/components/TopControlBar";
import { IS_DEVELOPMENT, IS_FORMBRICKS_CLOUD, IS_FORMBRICKS_SURVEYS_CONFIGURED } from "@/lib/constants";
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

type TCookieStore = Awaited<ReturnType<typeof cookies>>;

// Response-limit warning for Hobby (free) plan: 200 = 80% of the 250/mo cap, 250 = limit reached.
const getResponseWarningThreshold = (
  responseCount: number,
  cookieStore: TCookieStore
): "200" | "250" | null => {
  if (responseCount >= 250 && !cookieStore.get("trial_warning_shown_250")) {
    return "250";
  }
  if (
    responseCount >= 200 &&
    !cookieStore.get("trial_warning_shown_200") &&
    !cookieStore.get("trial_warning_shown_250")
  ) {
    return "200";
  }
  return null;
};

// Show the loss-aversion trial-ending modal once on each of the last 3 days of the trial.
const getTrialEndingDaysRemaining = (trialEnd: string | Date, cookieStore: TCookieStore): number | null => {
  const MS_PER_DAY = 86_400_000;
  const trialEndTime = new Date(trialEnd).getTime();
  if (!Number.isFinite(trialEndTime)) {
    return null;
  }
  const daysRemaining = Math.ceil((trialEndTime - Date.now()) / MS_PER_DAY);
  if (daysRemaining >= 1 && daysRemaining <= 3 && !cookieStore.get(`trial_ending_shown_${daysRemaining}`)) {
    return daysRemaining;
  }
  return null;
};

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
  // Hobby (free) plan only — excludes trial and paid (Pro/Scale) orgs.
  const isHobby = IS_FORMBRICKS_CLOUD && organization.billing?.stripe?.plan === "hobby";

  const [
    organizationWorkspacesLimit,
    newTrialBannerVariant,
    responseWarningVariant,
    trialEndingVariant,
    cookieStore,
  ] = await Promise.all([
    getOrganizationWorkspacesLimit(organization.id),
    getPostHogFeatureFlag(user.id, "a-b_navigation_rich-trial-banner-v2"),
    isHobby ? getPostHogFeatureFlag(user.id, "a-b_workspace_trial-response-warning") : Promise.resolve(null),
    isTrialing ? getPostHogFeatureFlag(user.id, "a-b_workspace_trial-ending-warning") : Promise.resolve(null),
    isTrialing || isHobby ? cookies() : Promise.resolve(null),
  ]);
  const isOwnerOrManager = isOwner || isManager;

  // Validate that workspace permission exists for members
  if (isMember && !workspacePermission) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  // (Hobby response warning and trial-ending target mutually exclusive audiences, so no stacking.)
  const responseWarningThreshold =
    isHobby && responseWarningVariant === "test" && cookieStore
      ? getResponseWarningThreshold(responseCount, cookieStore)
      : null;

  const trialEnd = organization.billing?.stripe?.trialEnd;
  const trialEndingDaysRemaining =
    isTrialing && trialEndingVariant === "test" && cookieStore && trialEnd
      ? getTrialEndingDaysRemaining(trialEnd, cookieStore)
      : null;

  const billingHref = `/workspaces/${workspace.id}/settings/organization/billing`;

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden">
      {/* Hide the limits-reached toast for Hobby users in the response-warning test variant — the modal replaces it with richer copy + CTAs. */}
      {IS_FORMBRICKS_CLOUD && !isTrialing && !(isHobby && responseWarningVariant === "test") && (
        <LimitsReachedBanner organization={organization} responseCount={responseCount} />
      )}

      <PendingDowngradeBanner
        organizationId={organization.id}
        lastChecked={lastChecked}
        isPendingDowngrade={isPendingDowngrade ?? false}
        active={active}
        locale={user.locale}
        status={status}
      />

      {responseWarningThreshold && (
        <TrialResponseWarningModal
          threshold={responseWarningThreshold}
          billingHref={billingHref}
          responseCount={responseCount}
        />
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
          isFormbricksSurveysConfigured={IS_FORMBRICKS_SURVEYS_CONFIGURED}
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
