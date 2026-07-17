"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { waitForBillingPlanAction } from "@/modules/ee/billing/actions";
import { Button } from "@/modules/ui/components/button";
import { Confetti } from "@/modules/ui/components/confetti";

const BILLING_CONFIRMATION_ORGANIZATION_ID_KEY = "billingConfirmationOrganizationId";
const SYNCABLE_PLANS = ["pro", "scale"] as const;
type TSyncablePlan = (typeof SYNCABLE_PLANS)[number];

const isSyncablePlan = (plan: string | null): plan is TSyncablePlan =>
  plan !== null && (SYNCABLE_PLANS as readonly string[]).includes(plan);

export const ConfirmationPage = () => {
  const { t } = useTranslation();
  const [showConfetti, setShowConfetti] = useState(false);
  const [resolvedOrganizationId, setResolvedOrganizationId] = useState<string | null>(null);
  // Block the back link until Stripe is synced, so returning to billing renders the new plan.
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setShowConfetti(true);

    if (globalThis.window === undefined) {
      return;
    }

    // Prefer the organizationId Stripe appends to the return URL so the back link survives a
    // fresh tab / cleared session storage; fall back to session storage otherwise.
    const params = new URLSearchParams(globalThis.window.location.search);
    const urlOrganizationId = params.get("organizationId");
    const storedOrganizationId = globalThis.window.sessionStorage.getItem(
      BILLING_CONFIRMATION_ORGANIZATION_ID_KEY
    );
    const organizationId = urlOrganizationId || storedOrganizationId;
    if (organizationId) {
      setResolvedOrganizationId(organizationId);
    }

    // The read-through sync only refreshes a >5min-stale snapshot, so the fresh post-checkout snapshot
    // still shows the old plan. Force a Stripe sync here (poll until the purchased plan lands) so the
    // billing page renders the new plan on return.
    const plan = params.get("plan");
    if (!organizationId || !isSyncablePlan(plan)) {
      return;
    }

    let cancelled = false;
    setIsSyncing(true);
    void waitForBillingPlanAction({ organizationId, targetPlan: plan }).finally(() => {
      if (!cancelled) {
        setIsSyncing(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const billingHref = resolvedOrganizationId
    ? `/organizations/${resolvedOrganizationId}/settings/billing`
    : "/";

  return (
    <div className="h-full w-full">
      {showConfetti && <Confetti />}
      <div className="mx-auto max-w-sm py-8 sm:px-6 lg:px-8">
        <div className="my-6 sm:flex-auto">
          <h1 className="text-center text-xl font-semibold text-slate-900">
            {t("billing_confirmation.upgrade_successful")}
          </h1>
          <p className="mt-2 text-center text-sm text-slate-700">
            {t("billing_confirmation.thanks_for_upgrading")}
          </p>
        </div>
        {isSyncing ? (
          <Button loading disabled className="w-full justify-center">
            {t("billing_confirmation.back_to_billing_overview")}
          </Button>
        ) : (
          <Button asChild className="w-full justify-center">
            {/* Full-document navigation (not next/link): a client transition would serve the billing
                page's prefetched RSC from before checkout, still showing the old plan. A full load
                re-renders it fresh with the upgraded plan. */}
            <a href={billingHref}>{t("billing_confirmation.back_to_billing_overview")}</a>
          </Button>
        )}
      </div>
    </div>
  );
};
