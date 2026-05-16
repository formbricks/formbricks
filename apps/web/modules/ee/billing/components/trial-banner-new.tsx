"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";

export const TRIAL_BASE_RESPONSE_LIMIT = 250;

interface TrialBannerNewProps {
  trialDaysRemaining: number;
  planName: string;
  responseCount: number;
  responseLimit: number | null;
  baseResponseLimit: number;
  billingHref: string;
  hasPaymentMethod?: boolean;
}

export const TrialBannerNew = ({
  trialDaysRemaining,
  planName,
  responseCount,
  responseLimit,
  baseResponseLimit,
  billingHref,
  hasPaymentMethod = false,
}: TrialBannerNewProps) => {
  const { t } = useTranslation();

  const effectiveLimit = responseLimit ?? baseResponseLimit;
  const progressPercent = Math.min((responseCount / effectiveLimit) * 100, 100);
  const planLabel = planName.charAt(0).toUpperCase() + planName.slice(1);

  return (
    <div className="m-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold text-slate-800">
          {trialDaysRemaining > 0
            ? t("common.trial_days_remaining", { count: trialDaysRemaining })
            : t("common.trial_expired")}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {planLabel} Trial
        </span>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        {responseCount} / <span className="line-through">{baseResponseLimit.toLocaleString()}</span>{" "}
        {effectiveLimit.toLocaleString()} {t("common.responses")}
      </p>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-600 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {!hasPaymentMethod && (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => posthog.capture("main_nav_add_payment_clicked")}>
          <Link href={billingHref}>{t("workspace.settings.billing.add_payment_method")}</Link>
        </Button>
      )}
    </div>
  );
};
