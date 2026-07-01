"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";

export const TRIAL_BASE_RESPONSE_LIMIT = 250;

interface TrialBannerNewProps {
  trialDaysRemaining: number;
  planName: string;
  responseCount: number;
  responseLimit: number | null;
  baseResponseLimit: number;
  billingHref: string;
}

export const TrialBannerNew = ({
  trialDaysRemaining,
  planName,
  responseCount,
  responseLimit,
  baseResponseLimit,
  billingHref,
}: TrialBannerNewProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  const effectiveLimit = responseLimit ?? baseResponseLimit;
  const progressPercent = Math.min((responseCount / effectiveLimit) * 100, 100);
  const planLabel = planName.charAt(0).toUpperCase() + planName.slice(1);

  return (
    <Link
      href={billingHref}
      onClick={() => posthog.capture("main_nav_go_to_billing_clicked")}
      className="m-2 block rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold text-slate-800">
          {trialDaysRemaining > 0
            ? t("common.trial_days_remaining", { count: trialDaysRemaining })
            : t("common.trial_expired")}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-slate-600">
          {t("common.trial_plan_badge", { plan: planLabel })}
        </span>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        {responseCount.toLocaleString(locale)} /{" "}
        <span className="line-through">{baseResponseLimit.toLocaleString(locale)}</span>{" "}
        {effectiveLimit.toLocaleString(locale)} {t("common.responses")}
      </p>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-600 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </Link>
  );
};
