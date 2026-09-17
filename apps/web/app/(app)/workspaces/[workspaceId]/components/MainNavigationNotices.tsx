"use client";

import { RocketIcon } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";
import { TOrganization } from "@formbricks/types/organizations";
import { TrialAlert } from "@/modules/ee/billing/components/trial-alert";
import { TRIAL_BASE_RESPONSE_LIMIT, TrialBannerNew } from "@/modules/ee/billing/components/trial-banner-new";

interface MainNavigationNoticesProps {
  isCollapsed: boolean;
  isOwnerOrManager: boolean;
  isFormbricksCloud: boolean;
  isDevelopment: boolean;
  latestVersion: string;
  // Whole days left in the trial, or null when there is no trial to count down. Derived by the
  // server layout rather than here — see the note on MainNavigation's own prop.
  trialDaysRemaining: number | null;
  newTrialBannerVariant: string | boolean;
  organization: TOrganization;
  responseCount: number;
}

/**
 * The two notice cards that sit above the sidebar's switchers: a self-hosted update prompt and the
 * cloud trial countdown.
 *
 * Split out of MainNavigation rather than inlined: both are gated on four or five conditions, which
 * pushed that component's cognitive complexity past the limit Sonar enforces (ENG-3076). Each
 * notice renders nothing unless every condition holds, so the caller can render this
 * unconditionally.
 */
export const MainNavigationNotices = ({
  isCollapsed,
  isOwnerOrManager,
  isFormbricksCloud,
  isDevelopment,
  latestVersion,
  trialDaysRemaining,
  newTrialBannerVariant,
  organization,
  responseCount,
}: Readonly<MainNavigationNoticesProps>) => {
  const { t } = useTranslation();

  // Collapsed, there is no room for either card, and both only ever address an owner/manager.
  if (isCollapsed || !isOwnerOrManager) {
    return null;
  }

  const showUpdateNotice = Boolean(latestVersion) && !isFormbricksCloud && !isDevelopment;
  const billingHref = `/organizations/${organization.id}/settings/billing`;

  return (
    <>
      {showUpdateNotice && (
        <Link
          href="https://github.com/formbricks/formbricks/releases"
          target="_blank"
          className="m-2 flex items-center gap-x-4 rounded-lg border border-slate-200 bg-slate-100 p-2 text-sm text-slate-800 hover:border-slate-300 hover:bg-slate-200">
          <p className="flex items-center justify-center gap-x-2 text-xs">
            <RocketIcon strokeWidth={1.5} className="mx-1 size-6 text-slate-900" />
            {t("common.new_version_available", { version: latestVersion })}
          </p>
        </Link>
      )}

      {/* Condition kept inline so `trialDaysRemaining` narrows to a number for the two cards. */}
      {isFormbricksCloud &&
        trialDaysRemaining !== null &&
        (newTrialBannerVariant === "test" ? (
          <TrialBannerNew
            trialDaysRemaining={trialDaysRemaining}
            planName={organization.billing.stripe?.plan ?? "pro"}
            responseCount={responseCount}
            responseLimit={organization.billing.limits.monthly.responses}
            baseResponseLimit={TRIAL_BASE_RESPONSE_LIMIT}
            billingHref={billingHref}
          />
        ) : (
          <Link
            href={billingHref}
            className="m-2 block"
            onClick={() => posthog.capture("main_nav_go_to_billing_clicked")}>
            <TrialAlert trialDaysRemaining={trialDaysRemaining} size="small" />
          </Link>
        ))}
    </>
  );
};
