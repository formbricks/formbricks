"use client";

import { type Stripe as StripeJs, loadStripe } from "@stripe/stripe-js";
import type { TFunction } from "i18next";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Trans, useTranslation } from "react-i18next";
import {
  type TCloudBillingInterval,
  type TOrganization,
  type TOrganizationStripePendingChange,
  type TOrganizationStripeSubscriptionStatus,
} from "@formbricks/types/organizations";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  changeBillingPlanAction,
  createPlanCheckoutAction,
  createTrialPaymentCheckoutAction,
  finalizeSetupCheckoutUpgradeAction,
  getUpgradeChargePreviewAction,
  manageSubscriptionAction,
  reportUpgradePaymentIssueAction,
  retryStripeSetupAction,
  undoPendingPlanChangeAction,
  waitForBillingPaymentMethodAction,
  waitForBillingPlanAction,
} from "../actions";
import type {
  TStripeBillingCatalogDisplay,
  TStripeBillingCatalogDisplayItem,
} from "../lib/stripe-billing-catalog";
import { PlanComparisonTable, type TPlanColumn } from "./plan-comparison";
import { PlanResponseFeature, PlanWorkflowRunsFeature } from "./response-pricing-tooltip";
import { TrialAlert } from "./trial-alert";
import { UsageCard } from "./usage-card";

const BILLING_CONFIRMATION_ORGANIZATION_ID_KEY = "billingConfirmationOrganizationId";
const BILLING_PENDING_UPGRADE_PLAN_KEY = "billingPendingUpgradePlan";
const BILLING_PENDING_UPGRADE_INTERVAL_KEY = "billingPendingUpgradeInterval";
// Hands the post-upgrade success toast across the full reload the finalize path does to render the
// synced plan.
const BILLING_UPGRADE_RESULT_KEY = "billingUpgradeResult";

// The plan lands in our DB via an async Stripe webhook, not instantly. Poll a force-sync until it
// reflects so we can render without a manual refresh; bounded so a stuck upgrade doesn't spin forever.
const UPGRADE_SYNC_POLL_INTERVAL_MS = 1500;
const UPGRADE_SYNC_POLL_TIMEOUT_MS = 45000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Stripe.js is loaded lazily and memoized across renders (one publishable key per deploy).
let stripeJsPromise: Promise<StripeJs | null> | null = null;
const getStripeJs = (publishableKey: string): Promise<StripeJs | null> =>
  (stripeJsPromise ??= loadStripe(publishableKey));

type TDisplayPlan = "hobby" | "pro" | "scale" | "custom" | "unknown";
type TStandardPlan = "hobby" | "pro" | "scale";

interface PricingTableProps {
  organization: TOrganization;
  responseCount: number;
  workspaceCount: number;
  workflowRunCount: number;
  isPlanComparison: boolean;
  usageCycleStart: Date;
  usageCycleEnd: Date;
  hasBillingRights: boolean;
  currentCloudPlan: TDisplayPlan;
  currentBillingInterval: TCloudBillingInterval | null;
  currentSubscriptionStatus: TOrganizationStripeSubscriptionStatus | null;
  pendingChange: TOrganizationStripePendingChange | null;
  isStripeSetupIncomplete: boolean;
  trialDaysRemaining: number | null;
  billingCatalog: TStripeBillingCatalogDisplay;
  stripePublishableKey: string | null;
}

const STANDARD_PLAN_LEVEL: Record<TStandardPlan, number> = {
  hobby: 0,
  pro: 1,
  scale: 2,
};

// Billing-catalog display item for the org's current plan/interval, or null for plans not in the
// standard catalog (custom/unknown). Kept out of the component to avoid a nested ternary and hold the
// component's cognitive complexity down.
const getCurrentPlanCatalogItem = (
  billingCatalog: TStripeBillingCatalogDisplay,
  currentCloudPlan: TDisplayPlan,
  interval: TCloudBillingInterval
): TStripeBillingCatalogDisplayItem | null => {
  if (currentCloudPlan === "hobby") return billingCatalog.hobby.monthly;
  if (currentCloudPlan === "pro") return billingCatalog.pro[interval];
  if (currentCloudPlan === "scale") return billingCatalog.scale[interval];
  return null;
};

const getCurrentCloudPlanLabel = (plan: TDisplayPlan, t: (key: string) => string) => {
  if (plan === "hobby") return t("workspace.settings.billing.plan_hobby");
  if (plan === "pro") return t("workspace.settings.billing.plan_pro");
  if (plan === "scale") return t("workspace.settings.billing.plan_scale");
  if (plan === "custom") return t("workspace.settings.billing.plan_custom");
  return t("workspace.settings.billing.plan_unknown");
};

const formatMoney = (currency: string, unitAmount: number | null, locale: string) => {
  if (unitAmount == null) {
    return "—";
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: unitAmount % 100 === 0 ? 0 : 2,
  }).format(unitAmount / 100);
};

type TPlanFeature =
  | { type: "text"; label: string }
  | { type: "responses"; plan: "pro" | "scale" }
  | { type: "workflow_runs"; plan: "scale" };

type TPlanCardData = {
  plan: TStandardPlan;
  interval: TCloudBillingInterval;
  amount: string;
  description: string;
  features: TPlanFeature[];
};

const getPlanPeriodLabel = (
  plan: TStandardPlan,
  interval: TCloudBillingInterval,
  t: (key: string) => string
) => {
  if (plan === "hobby" || interval === "monthly") {
    return t("workspace.settings.billing.per_month");
  }

  return t("workspace.settings.billing.per_year");
};

const getPlanChangePayload = (
  organizationId: string,
  plan: TStandardPlan,
  interval: TCloudBillingInterval
) =>
  plan === "hobby"
    ? {
        organizationId,
        targetPlan: "hobby" as const,
        targetInterval: "monthly" as const,
      }
    : {
        organizationId,
        targetPlan: plan,
        targetInterval: interval,
      };

const getPlanChangeSuccessMessage = (
  mode: "immediate" | "scheduled" | undefined,
  t: (key: string) => string
) => {
  if (mode === "scheduled") {
    return t("workspace.settings.billing.plan_change_scheduled");
  }

  return t("workspace.settings.billing.plan_change_applied");
};

const getActionErrorMessage = (serverError: string, t: (key: string) => string) => {
  if (serverError === "mixed_interval_checkout_unsupported") {
    return t("workspace.settings.billing.yearly_checkout_unavailable");
  }

  if (serverError === "payment_method_required") {
    return t("workspace.settings.billing.payment_method_required");
  }

  // Trial conversion charges synchronously (payment_behavior: "error_if_incomplete"), so a card
  // needing 3DS errors out with nothing left to confirm. Say so instead of a generic failure.
  if (serverError === "card_authentication_required") {
    return t("workspace.settings.billing.payment_authentication_failed");
  }

  return t("common.something_went_wrong_please_try_again");
};

const isCurrentPlanSelection = (
  plan: TStandardPlan,
  interval: TCloudBillingInterval,
  currentCloudPlan: TDisplayPlan,
  currentBillingInterval: TCloudBillingInterval | null
) => currentCloudPlan === plan && (plan === "hobby" || currentBillingInterval === interval);

const canCancelCurrentPaidPlanAtPeriodEnd = (
  plan: TStandardPlan,
  interval: TCloudBillingInterval,
  currentCloudPlan: TDisplayPlan,
  currentBillingInterval: TCloudBillingInterval | null,
  isTrialing: boolean,
  pendingChange: TOrganizationStripePendingChange | null
) =>
  plan !== "hobby" &&
  // Any trial (with or without a card) selecting its current paid plan is CONVERTING to paid
  // ("Upgrade now"), never cancelling at period end — excluding only no-card trials here let a
  // card-backed "Upgrade now" click fall into cancel-at-period-end, scheduling a Hobby downgrade
  // instead of converting.
  !isTrialing &&
  pendingChange?.targetPlan !== "hobby" &&
  isCurrentPlanSelection(plan, interval, currentCloudPlan, currentBillingInterval);

const isSwitchAtPeriodEndCta = (
  plan: TStandardPlan,
  interval: TCloudBillingInterval,
  currentCloudPlan: TDisplayPlan,
  currentBillingInterval: TCloudBillingInterval | null,
  currentPlanLevel: number | null,
  isTrialingWithoutPayment: boolean,
  hasPaymentMethod: boolean,
  pendingChange: TOrganizationStripePendingChange | null
) => {
  if (currentPlanLevel === null) {
    return false;
  }

  if (isCurrentPlanSelection(plan, interval, currentCloudPlan, currentBillingInterval)) {
    return false;
  }

  const isPendingSelection =
    pendingChange?.targetPlan === plan && (plan === "hobby" || pendingChange.targetInterval === interval);
  if (isPendingSelection) {
    return false;
  }

  if (!hasPaymentMethod && plan !== "hobby") {
    return false;
  }

  if (isTrialingWithoutPayment && plan === "hobby") {
    return false;
  }

  return STANDARD_PLAN_LEVEL[plan] <= currentPlanLevel;
};

// Renders one plan-card feature row. Metered features (responses, workflow runs) show a tier tooltip
// sourced from the catalog; plain text features just render their label. Extracted from PricingTable
// to keep that component's cognitive complexity within bounds.
const PlanFeatureContent = ({
  feature,
  billingCatalog,
  selectedInterval,
  locale,
  t,
}: Readonly<{
  feature: TPlanFeature;
  billingCatalog: TStripeBillingCatalogDisplay;
  selectedInterval: TCloudBillingInterval;
  locale: string;
  t: TFunction;
}>) => {
  if (feature.type === "text") {
    return <>{feature.label}</>;
  }

  if (feature.type === "responses") {
    return (
      <PlanResponseFeature
        plan={feature.plan}
        locale={locale}
        overage={billingCatalog[feature.plan][selectedInterval].responseOverage}
        t={t}
      />
    );
  }

  return (
    <PlanWorkflowRunsFeature
      locale={locale}
      overage={billingCatalog[feature.plan][selectedInterval].workflowRunsOverage}
      t={t}
    />
  );
};

export const PricingTable = ({
  organization,
  responseCount,
  workspaceCount,
  workflowRunCount,
  isPlanComparison,
  usageCycleStart,
  usageCycleEnd,
  hasBillingRights,
  currentCloudPlan,
  currentBillingInterval,
  currentSubscriptionStatus,
  pendingChange,
  isStripeSetupIncomplete,
  trialDaysRemaining,
  billingCatalog,
  stripePublishableKey,
}: PricingTableProps) => {
  const { t, i18n } = useTranslation();
  const organizationId = organization.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const upgradeDriveRef = useRef(false);
  const trialCardDriveRef = useRef(false);
  // Monotonic token guarding the lazy upgrade-charge preview: openConfirmation bumps it so a stale
  // preview can never leak into the modal (mislabeling the "Pay $X now" amount);
  // closeUpgradeConfirmation bumps it too, discarding a dismissed modal's in-flight preview.
  const previewRequestRef = useRef(0);
  const [isRetryingStripeSetup, setIsRetryingStripeSetup] = useState(false);
  const [isPlanActionPending, setIsPlanActionPending] = useState<string | null>(null);
  // Set when an immediate upgrade charge needs confirmation. mode "upgrade" = single confirm (tier
  // upgrade / card-backed convert); "trial-continue" = the pay-prorated-now-or-keep-trial choice modal.
  const [upgradeConfirmation, setUpgradeConfirmation] = useState<{
    plan: Exclude<TStandardPlan, "hobby">;
    interval: TCloudBillingInterval;
    mode: "upgrade" | "trial-continue";
  } | null>(null);
  // Amount Stripe would charge now (full price incl. tax), fetched lazily for the confirm modal.
  const [upgradePreview, setUpgradePreview] = useState<{
    amountDue: number;
    currency: string;
  } | null>(null);
  const [isLoadingUpgradePreview, setIsLoadingUpgradePreview] = useState(false);
  // A Pro trial returning to Hobby switches immediately (server ends the trial now), so it's gated
  // behind a confirmation dialog. Paid plans still schedule the downgrade for period end (no dialog).
  const [isHobbyDowngradeConfirmOpen, setIsHobbyDowngradeConfirmOpen] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<TCloudBillingInterval>(
    currentBillingInterval ?? "monthly"
  );

  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const isTrialing = currentSubscriptionStatus === "trialing";
  const hasPaymentMethod = organization.billing.stripe?.hasPaymentMethod === true;
  const existingSubscriptionId = organization.billing.stripe?.subscriptionId ?? null;
  const canShowSubscriptionButton = hasBillingRights && !!organization.billing.stripeCustomerId;
  const isTrialingWithoutPayment = isTrialing && !hasPaymentMethod;
  // Trialing with a card on file: selecting a paid plan converts the trial and charges now (so the
  // user unlocks links/follow-ups immediately), behind the confirm modal so they know they're billed.
  const isTrialingWithPayment = isTrialing && hasPaymentMethod;
  // The paid plan being trialed (Pro today) — the trial banner's pay-now CTA targets it.
  const trialedPaidPlan =
    isTrialing && (currentCloudPlan === "pro" || currentCloudPlan === "scale") ? currentCloudPlan : null;
  const showPlanSelector = !isStripeSetupIncomplete;
  const usageCycleLabel = `${formatDateForDisplay(usageCycleStart, locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })} - ${formatDateForDisplay(usageCycleEnd, locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })}`;
  const responsesUnlimitedCheck = organization.billing.limits.monthly.responses === null;
  const workspacesUnlimitedCheck = organization.billing.limits.workspaces === null;
  // The workflow-runs card's included volume comes from the billing catalog (derived from the price's
  // own free tier), NOT the entitlement limit, so the number shown is exactly what Stripe leaves
  // uncharged — the two can't drift and reassure a customer they're inside an allowance while being
  // billed (ENG-2193/2194). Null when the current plan has no workflow price, so the card hides.
  const currentPlanCatalogItem = getCurrentPlanCatalogItem(
    billingCatalog,
    currentCloudPlan,
    currentBillingInterval ?? "monthly"
  );
  const workflowRunsLimit = currentPlanCatalogItem?.workflowRunsIncluded ?? null;
  const trialEndDate = organization.billing.stripe?.trialEnd
    ? new Date(organization.billing.stripe.trialEnd)
    : null;
  const trialEndLabel =
    trialEndDate && Number.isFinite(trialEndDate.getTime())
      ? formatDateForDisplay(trialEndDate, locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })
      : null;
  const currentPlanLevel =
    currentCloudPlan === "hobby" || currentCloudPlan === "pro" || currentCloudPlan === "scale"
      ? STANDARD_PLAN_LEVEL[currentCloudPlan]
      : null;

  const clearUpgradeIntent = () => {
    if (globalThis.window === undefined) {
      return;
    }

    globalThis.window.sessionStorage.removeItem(BILLING_PENDING_UPGRADE_PLAN_KEY);
    globalThis.window.sessionStorage.removeItem(BILLING_PENDING_UPGRADE_INTERVAL_KEY);
  };

  const persistUpgradeIntent = (plan: Exclude<TStandardPlan, "hobby">, interval: TCloudBillingInterval) => {
    if (globalThis.window === undefined) {
      return;
    }

    globalThis.window.sessionStorage.setItem(BILLING_PENDING_UPGRADE_PLAN_KEY, plan);
    globalThis.window.sessionStorage.setItem(BILLING_PENDING_UPGRADE_INTERVAL_KEY, interval);
  };

  // On-session 3D Secure for the upgrade invoice PaymentIntent (uses the saved default card).
  const confirmUpgradeSca = async (
    clientSecret: string
  ): Promise<{ status: "succeeded" | "processing" | "failed"; paymentIntentId: string | null }> => {
    if (!stripePublishableKey) {
      return { status: "failed", paymentIntentId: null };
    }
    const stripe = await getStripeJs(stripePublishableKey);
    if (!stripe) {
      return { status: "failed", paymentIntentId: null };
    }
    const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret);
    if (error) {
      return { status: "failed", paymentIntentId: error.payment_intent?.id ?? null };
    }
    if (paymentIntent?.status === "succeeded") {
      return { status: "succeeded", paymentIntentId: paymentIntent.id };
    }
    if (paymentIntent?.status === "processing") {
      return { status: "processing", paymentIntentId: paymentIntent.id };
    }
    return { status: "failed", paymentIntentId: paymentIntent?.id ?? null };
  };

  // Completes any required SCA; returns whether the upgrade is applied (succeeded/processing).
  const settleUpgradeConfirmation = async (data: {
    requiresAction?: boolean;
    clientSecret?: string | null;
  }): Promise<{ applied: boolean; message: string | null }> => {
    if (!data.requiresAction || !data.clientSecret) {
      return { applied: true, message: null };
    }

    const outcome = await confirmUpgradeSca(data.clientSecret);
    if (outcome.status === "succeeded" || outcome.status === "processing") {
      return { applied: true, message: null };
    }

    // Abandoned/declined: persist the banner directly (webhook cancel fires late).
    if (outcome.paymentIntentId) {
      await reportUpgradePaymentIssueAction({
        organizationId,
        paymentIntentId: outcome.paymentIntentId,
      });
    }
    return {
      applied: false,
      message: t("workspace.settings.billing.payment_authentication_failed"),
    };
  };

  // Show the success toast that the finalize path stashed before its full reload (see finish()).
  useEffect(() => {
    if (globalThis.window === undefined) {
      return;
    }
    const raw = globalThis.window.sessionStorage.getItem(BILLING_UPGRADE_RESULT_KEY);
    if (!raw) {
      return;
    }
    globalThis.window.sessionStorage.removeItem(BILLING_UPGRADE_RESULT_KEY);
    try {
      const { plan } = JSON.parse(raw) as { plan: TStandardPlan };
      toast.success(
        t("workspace.settings.billing.upgrade_checkout_success", {
          plan: getCurrentCloudPlanLabel(plan ?? "pro", t),
        })
      );
    } catch {
      // Malformed handoff payload — nothing to show.
    }
  }, [t]);

  useEffect(() => {
    if (searchParams.get("checkout_success") !== "1") {
      return;
    }

    if (searchParams.get("upgrade_pending") !== "1") {
      // Card-only setup checkout (e.g. "Continue with Pro after trial"): the webhook attaches the
      // card asynchronously, so a single router.refresh() can race it and leave the stale "add a
      // payment method" CTA showing. Force a bounded resync until the card reflects, then hard-reload
      // (router.refresh() doesn't reliably refetch the billing snapshot) to deterministically drop the CTA.
      if (globalThis.window === undefined || trialCardDriveRef.current) {
        return;
      }
      trialCardDriveRef.current = true;
      const billingUrl = `/organizations/${organizationId}/settings/billing`;
      // Resync can take a few seconds; show a loading state so it doesn't read as a broken save.
      // Generic "Saving" (not the plan-change toast): only the card changes here, not the plan/trial.
      const cardSyncToastId = toast.loading(t("common.saving"));
      void (async () => {
        try {
          await waitForBillingPaymentMethodAction({ organizationId });
        } finally {
          toast.dismiss(cardSyncToastId);
          // Full reload strips checkout_success (blocks re-run on back-nav/refresh) and
          // deterministically re-renders against the now-synced snapshot.
          globalThis.window.location.replace(billingUrl);
        }
      })();
      return;
    }

    // Setup checkout saved the card; finalize the (SCA-capable, on-session) upgrade here.
    if (globalThis.window === undefined || upgradeDriveRef.current) {
      return;
    }

    const checkoutSessionId = searchParams.get("session_id");
    if (!checkoutSessionId) {
      return;
    }

    // Read only for the success-toast label; the finalize action is the source of truth.
    const pendingPlan = globalThis.window.sessionStorage.getItem(BILLING_PENDING_UPGRADE_PLAN_KEY) as Exclude<
      TStandardPlan,
      "hobby"
    > | null;

    // upgradeDriveRef guarantees a single run; deliberately no `cancelled` cleanup flag — StrictMode's
    // dev mount→unmount→mount would otherwise cancel the real run before the reload, leaving it stale.
    upgradeDriveRef.current = true;
    // Loading toast at the top of this first post-checkout page, shown while we poll for the plan.
    const toastId = toast.loading(t("workspace.settings.billing.upgrade_checkout_pending"));
    const billingUrl = `/organizations/${organizationId}/settings/billing`;

    // A full reload is the only reliable way to render the confirmed plan (router.refresh() doesn't
    // consistently refetch the billing snapshot); hand the toast across it.
    const reloadWithToast = (plan: Exclude<TStandardPlan, "hobby"> | null) => {
      if (globalThis.window === undefined) return;
      globalThis.window.sessionStorage.setItem(
        BILLING_UPGRADE_RESULT_KEY,
        JSON.stringify({ plan: plan ?? "pro" })
      );
      globalThis.window.location.replace(billingUrl);
    };

    // Terminal state without a reload (error, or the poll timed out): clean the URL, dismiss the
    // loading toast, surface a message. The webhook will still land the plan; the user can refresh.
    const settleWithoutReload = (message: string) => {
      clearUpgradeIntent();
      toast.dismiss(toastId);
      toast.error(message);
      if (globalThis.window !== undefined) {
        globalThis.window.history.replaceState(null, "", billingUrl);
      }
      router.refresh();
    };

    // Poll a Stripe force-sync until the plan reflects in our DB (waitForBillingPlanAction syncs +
    // invalidates the cache each call). Doesn't depend on the async webhook.
    const pollUntilPlanApplied = async (targetPlan: Exclude<TStandardPlan, "hobby">): Promise<boolean> => {
      const deadline = Date.now() + UPGRADE_SYNC_POLL_TIMEOUT_MS;
      for (;;) {
        const waitResult = await waitForBillingPlanAction({ organizationId, targetPlan });
        if (waitResult?.data?.plan === targetPlan) return true;
        if (Date.now() >= deadline) return false;
        await sleep(UPGRADE_SYNC_POLL_INTERVAL_MS);
      }
    };

    const run = async () => {
      // Finalize attaches the saved card and applies the upgrade; the plan then reflects in our DB
      // asynchronously, which is what pollUntilPlanApplied waits for below.
      const response = await finalizeSetupCheckoutUpgradeAction({ organizationId, checkoutSessionId });

      if (response?.serverError) {
        settleWithoutReload(getActionErrorMessage(response.serverError, t));
        return;
      }

      const resolvedPlan =
        (response?.data && "targetPlan" in response.data ? response.data.targetPlan : null) ?? pendingPlan;

      if (response?.data) {
        const settled = await settleUpgradeConfirmation(response.data);
        if (!settled.applied) {
          settleWithoutReload(settled.message ?? t("common.something_went_wrong_please_try_again"));
          return;
        }
      }

      if (!resolvedPlan) {
        // No target to verify against — best effort: reload so any applied change renders.
        reloadWithToast(resolvedPlan);
        return;
      }

      if (await pollUntilPlanApplied(resolvedPlan)) {
        reloadWithToast(resolvedPlan);
      } else {
        // Poll window elapsed without the plan reflecting; the webhook will still catch up.
        settleWithoutReload(t("workspace.settings.billing.upgrade_checkout_pending"));
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, t, organizationId]);

  const paymentError = organization.billing.stripe?.paymentAttemptError;

  useEffect(() => {
    if (!paymentError) {
      return;
    }

    const paymentErrorMessage =
      paymentError.type === "requires_action"
        ? t("workspace.settings.billing.payment_error_requires_action")
        : t("workspace.settings.billing.payment_error_failed_invoice");

    const toastId = toast.error(
      <div>
        <div className="font-medium">{paymentErrorMessage}</div>
        <div className="mt-2 text-sm">
          <Trans
            i18nKey="workspace.settings.billing.payment_error_contact_support"
            components={{
              supportLink: <a href="mailto:hola@formbricks.com" className="font-medium underline" />,
            }}
          />
        </div>
      </div>,
      {
        duration: 10000,
        icon: "⚠️",
      }
    );

    return () => {
      toast.dismiss(toastId);
    };
    // Keyed on scalar fields: the billing snapshot object gets a new reference on every
    // server render (router.refresh), which would re-fire the toast for the same error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentError?.type, paymentError?.paymentIntentId, paymentError?.createdAt, t]);

  const planCards = useMemo<TPlanCardData[]>(() => {
    return [
      {
        plan: "hobby",
        interval: "monthly",
        amount: formatMoney(
          billingCatalog.hobby.monthly.currency,
          billingCatalog.hobby.monthly.unitAmount,
          locale
        ),
        description: t("workspace.settings.billing.plan_hobby_description"),
        features: [
          { type: "text", label: t("workspace.settings.billing.plan_hobby_feature_responses") },
          { type: "text", label: t("workspace.settings.billing.plan_hobby_feature_workspaces") },
          { type: "text", label: t("workspace.settings.billing.plan_hobby_feature_surveys") },
          { type: "text", label: t("workspace.settings.billing.plan_hobby_feature_question_types") },
          { type: "text", label: t("workspace.settings.billing.plan_hobby_feature_logic") },
          { type: "text", label: t("workspace.settings.billing.plan_hobby_feature_partial") },
          { type: "text", label: t("workspace.settings.billing.plan_hobby_feature_file_uploads") },
          { type: "text", label: t("workspace.settings.billing.plan_hobby_feature_api") },
        ],
      },
      {
        plan: "pro",
        interval: selectedInterval,
        amount: formatMoney(
          billingCatalog.pro[selectedInterval].currency,
          billingCatalog.pro[selectedInterval].unitAmount,
          locale
        ),
        description: t("workspace.settings.billing.plan_pro_description"),
        features: [
          { type: "text", label: t("workspace.settings.billing.plan_feature_everything_in_hobby") },
          { type: "text", label: t("workspace.settings.billing.plan_pro_feature_smart_tools") },
          { type: "responses", plan: "pro" },
          { type: "text", label: t("workspace.settings.billing.plan_pro_feature_workspaces") },
          { type: "text", label: t("workspace.settings.billing.plan_pro_feature_unlimited_seats") },
          { type: "text", label: t("workspace.settings.billing.plan_pro_feature_hide_branding") },
          { type: "text", label: t("workspace.settings.billing.plan_pro_feature_contacts") },
          { type: "text", label: t("workspace.settings.billing.plan_pro_feature_integrations") },
          { type: "text", label: t("workspace.settings.billing.plan_pro_feature_sdks") },
          { type: "text", label: t("workspace.settings.billing.plan_pro_feature_ai_translations") },
        ],
      },
      {
        plan: "scale",
        interval: selectedInterval,
        amount: formatMoney(
          billingCatalog.scale[selectedInterval].currency,
          billingCatalog.scale[selectedInterval].unitAmount,
          locale
        ),
        description: t("workspace.settings.billing.plan_scale_description"),
        features: [
          { type: "text", label: t("workspace.settings.billing.plan_feature_everything_in_pro") },
          { type: "responses", plan: "scale" },
          { type: "text", label: t("workspace.settings.billing.plan_scale_feature_workspaces") },
          { type: "text", label: t("workspace.settings.billing.plan_scale_feature_rbac") },
          { type: "text", label: t("workspace.settings.billing.plan_scale_feature_quota") },
          { type: "workflow_runs", plan: "scale" },
          { type: "text", label: t("workspace.settings.billing.plan_scale_feature_feedback") },
          { type: "text", label: t("workspace.settings.billing.plan_scale_feature_semantic_analysis") },
          { type: "text", label: t("workspace.settings.billing.plan_scale_feature_security") },
        ],
      },
    ];
  }, [billingCatalog, locale, selectedInterval, t]);

  const persistOrganizationId = () => {
    if (globalThis.window !== undefined) {
      globalThis.window.sessionStorage.setItem(BILLING_CONFIRMATION_ORGANIZATION_ID_KEY, organizationId);
    }
  };

  const navigateToExternalUrl = (url: string) => {
    if (globalThis.window !== undefined) {
      globalThis.window.location.href = url;
    }
  };

  const openBillingPortal = async () => {
    const response = await manageSubscriptionAction({ organizationId });
    if (response?.serverError) {
      toast.error(getActionErrorMessage(response.serverError, t));
      return;
    }
    if (response?.data && typeof response.data === "string") {
      router.push(response.data);
      return;
    }

    toast.error(t("common.something_went_wrong_please_try_again"));
  };

  const openUpgradeCheckout = async (
    plan: Exclude<TStandardPlan, "hobby">,
    interval: TCloudBillingInterval
  ) => {
    try {
      persistOrganizationId();
      persistUpgradeIntent(plan, interval);
      const response = await createTrialPaymentCheckoutAction({
        organizationId,
        targetPlan: plan,
        targetInterval: interval,
      });
      if (response?.serverError) {
        clearUpgradeIntent();
        toast.error(getActionErrorMessage(response.serverError, t));
        return;
      }
      if (response?.data && typeof response.data === "string") {
        navigateToExternalUrl(response.data);
        return;
      }
      clearUpgradeIntent();
      toast.error(t("common.something_went_wrong_please_try_again"));
    } catch (error) {
      clearUpgradeIntent();
      console.error("Failed to create upgrade checkout session:", error);
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  const retryStripeSetup = async () => {
    setIsRetryingStripeSetup(true);
    try {
      const response = await retryStripeSetupAction({ organizationId: organization.id });
      if (response?.serverError) {
        toast.error(getActionErrorMessage(response.serverError, t));
        return;
      }
      if (response?.data) {
        router.refresh();
        return;
      }
      toast.error(t("common.something_went_wrong_please_try_again"));
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsRetryingStripeSetup(false);
    }
  };

  const redirectToPlanCheckout = async (
    plan: Exclude<TStandardPlan, "hobby">,
    interval: TCloudBillingInterval
  ): Promise<void> => {
    if (existingSubscriptionId) {
      await openUpgradeCheckout(plan, interval);
      return;
    }

    if (interval === "yearly") {
      toast.error(t("workspace.settings.billing.yearly_checkout_unavailable"));
      return;
    }

    persistOrganizationId();
    const response = await createPlanCheckoutAction({
      organizationId,
      targetPlan: plan,
      targetInterval: interval,
    });
    if (response?.serverError) {
      toast.error(getActionErrorMessage(response.serverError, t));
      return;
    }

    if (response?.data && typeof response.data === "string") {
      navigateToExternalUrl(response.data);
      return;
    }

    toast.error(t("common.something_went_wrong_please_try_again"));
  };

  const handlePlanAction = async (plan: TStandardPlan, interval: TCloudBillingInterval) => {
    posthog.capture("billing_pricing_cta_clicked", {
      plan,
      interval,
      cta: getCtaKey(plan, interval),
    });

    const actionKey = `${plan}-${interval}`;
    setIsPlanActionPending(actionKey);

    try {
      if (!hasPaymentMethod && plan !== "hobby") {
        await redirectToPlanCheckout(plan, interval);
        return;
      }

      if (
        canCancelCurrentPaidPlanAtPeriodEnd(
          plan,
          interval,
          currentCloudPlan,
          currentBillingInterval,
          isTrialing,
          pendingChange
        )
      ) {
        const response = await changeBillingPlanAction(
          getPlanChangePayload(organizationId, "hobby", "monthly")
        );
        if (response?.serverError) {
          toast.error(getActionErrorMessage(response.serverError, t));
          return;
        }
        toast.success(getPlanChangeSuccessMessage(response?.data?.mode, t));
        router.refresh();
        return;
      }

      const response = await changeBillingPlanAction(getPlanChangePayload(organizationId, plan, interval));
      if (response?.serverError) {
        toast.error(getActionErrorMessage(response.serverError, t));
        return;
      }

      if (response?.data) {
        const settled = await settleUpgradeConfirmation(response.data);
        if (!settled.applied) {
          if (settled.message) {
            toast.error(settled.message);
          }
          router.refresh();
          return;
        }
        if (response.data.mode === "immediate") {
          // Force-sync until the converted plan lands, then hand the success toast across a full
          // reload — router.refresh() alone doesn't reliably refetch the billing snapshot, so "current
          // plan" would keep showing the trial until a manual refresh.
          await waitForBillingPlanAction({ organizationId, targetPlan: plan });
          if (globalThis.window !== undefined) {
            globalThis.window.sessionStorage.setItem(BILLING_UPGRADE_RESULT_KEY, JSON.stringify({ plan }));
            globalThis.window.location.reload();
            return;
          }
        }
      }

      toast.success(getPlanChangeSuccessMessage(response?.data?.mode, t));
      router.refresh();
    } catch (error) {
      console.error("Failed to change billing plan:", error);
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsPlanActionPending(null);
    }
  };

  // True for any card-on-file path that bills immediately (goes behind the confirm modal): a tier
  // upgrade, or a trial conversion to any paid plan (ends the trial and charges now).
  const willChargeImmediately = (plan: TStandardPlan, interval: TCloudBillingInterval): boolean => {
    if (plan === "hobby" || !hasPaymentMethod) return false;
    if (isTrialingWithPayment) return true;
    return (
      currentPlanLevel !== null &&
      STANDARD_PLAN_LEVEL[plan] > currentPlanLevel &&
      !isCurrentPlanSelection(plan, interval, currentCloudPlan, currentBillingInterval) &&
      !canCancelCurrentPaidPlanAtPeriodEnd(
        plan,
        interval,
        currentCloudPlan,
        currentBillingInterval,
        isTrialing,
        pendingChange
      )
    );
  };

  // A no-card trial upgrading to a different paid plan adds a card and is charged immediately, so it
  // must go behind the same confirm modal. Continuing the same trial plan only saves a card (billed
  // at trial_end, not now), so it's intentionally excluded.
  const willChargeAfterAddingCard = (plan: TStandardPlan, interval: TCloudBillingInterval): boolean =>
    isTrialingWithoutPayment &&
    plan !== "hobby" &&
    !isCurrentPlanSelection(plan, interval, currentCloudPlan, currentBillingInterval);

  // The Pro-trial "continue" choice: on the plan currently trialed, pick between paying the full
  // price now (unlock immediately) or keeping the free trial.
  const isProTrialContinue = (plan: TStandardPlan, interval: TCloudBillingInterval): boolean =>
    isTrialing &&
    plan !== "hobby" &&
    isCurrentPlanSelection(plan, interval, currentCloudPlan, currentBillingInterval);

  const openConfirmation = (
    plan: Exclude<TStandardPlan, "hobby">,
    interval: TCloudBillingInterval,
    mode: "upgrade" | "trial-continue"
  ) => {
    setUpgradeConfirmation({ plan, interval, mode });
    // Fetch the full charge to show — every conversion and upgrade is billed at full price.
    setUpgradePreview(null);
    setIsLoadingUpgradePreview(true);
    const requestId = ++previewRequestRef.current;
    getUpgradeChargePreviewAction({
      organizationId,
      targetPlan: plan,
      targetInterval: interval,
    })
      .then((response) => {
        if (previewRequestRef.current !== requestId) return;
        setUpgradePreview(response?.data ?? null);
      })
      .catch(() => {
        if (previewRequestRef.current !== requestId) return;
        setUpgradePreview(null);
      })
      .finally(() => {
        if (previewRequestRef.current !== requestId) return;
        setIsLoadingUpgradePreview(false);
      });
  };

  // Gate any charge-now action behind a confirmation modal; everything else runs as before.
  const requestPlanAction = (plan: TStandardPlan, interval: TCloudBillingInterval) => {
    if (plan === "hobby") {
      // Returning to Hobby from a Pro trial switches immediately — confirm before ending the trial.
      // A paid plan just schedules the downgrade for period end, so it needs no dialog.
      if (isTrialing) {
        setIsHobbyDowngradeConfirmOpen(true);
        return;
      }
      void handlePlanAction(plan, interval);
      return;
    }
    // The two-option "pay now or keep the trial" modal is only for a trial WITHOUT a card yet. Once
    // a card is on file, "Upgrade now" is a normal full-price confirm (below).
    if (isProTrialContinue(plan, interval) && !hasPaymentMethod) {
      openConfirmation(plan, interval, "trial-continue");
      return;
    }
    if (willChargeImmediately(plan, interval) || willChargeAfterAddingCard(plan, interval)) {
      openConfirmation(plan, interval, "upgrade");
      return;
    }
    void handlePlanAction(plan, interval);
  };

  // Primary action of the trial-continue modal: pay the full price now and convert to paid. Both
  // branches mark the CTA pending before dispatching — the no-card branch skips handlePlanAction
  // (which owns that state) and would otherwise look idle during the Checkout round-trip, inviting a
  // double-click.
  const handleTrialPayNow = (plan: Exclude<TStandardPlan, "hobby">, interval: TCloudBillingInterval) => {
    if (hasPaymentMethod) {
      void handlePlanAction(plan, interval); // card on file -> convert immediately
      return;
    }
    setIsPlanActionPending(`${plan}-${interval}`);
    // add card -> applySetupCheckoutUpgrade converts. On success the tab is already navigating to
    // Stripe, so what matters is that the error path re-enables the CTA.
    void redirectToPlanCheckout(plan, interval).finally(() => setIsPlanActionPending(null));
  };

  const closeUpgradeConfirmation = () => {
    // Invalidate any in-flight preview so its resolution can't repopulate a just-closed modal.
    previewRequestRef.current += 1;
    setUpgradeConfirmation(null);
    setUpgradePreview(null);
    setIsLoadingUpgradePreview(false);
  };

  const undoPendingChange = async () => {
    setIsPlanActionPending("undo");
    try {
      const response = await undoPendingPlanChangeAction({ organizationId });
      if (response?.serverError) {
        toast.error(getActionErrorMessage(response.serverError, t));
        return;
      }
      if (response?.data) {
        toast.success(t("workspace.settings.billing.pending_change_removed"));
        router.refresh();
        return;
      }

      toast.error(t("common.something_went_wrong_please_try_again"));
    } catch (error) {
      console.error("Failed to undo pending plan change:", error);
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsPlanActionPending(null);
    }
  };

  const getCtaKey = (plan: TStandardPlan, interval: TCloudBillingInterval) => {
    const isCurrentSelection = isCurrentPlanSelection(
      plan,
      interval,
      currentCloudPlan,
      currentBillingInterval
    );

    if (isCurrentSelection && isTrialingWithoutPayment) return "unlock_all_plan_features";
    if (isTrialingWithoutPayment && plan === "hobby") return "downgrade_to_hobby";
    // Trial + card: any paid plan converts the trial and charges now (even the trialed plan itself),
    // so it reads as an upgrade rather than "current plan".
    if (isTrialingWithPayment && plan !== "hobby") return "upgrade_now";
    if (
      canCancelCurrentPaidPlanAtPeriodEnd(
        plan,
        interval,
        currentCloudPlan,
        currentBillingInterval,
        isTrialing,
        pendingChange
      )
    )
      return "cancel_at_period_end";
    // The current plan stays "Current plan" even while a downgrade is scheduled — only the pending
    // TARGET card (matched by isPendingSelection below) shows "Scheduled". The banner handles undo.
    if (isCurrentSelection) return "current_plan_cta";
    const isPendingSelection =
      pendingChange?.targetPlan === plan && (plan === "hobby" || pendingChange.targetInterval === interval);
    if (isPendingSelection) return "pending_plan_cta";
    if (!hasPaymentMethod && plan !== "hobby") return "upgrade_now";
    if (currentPlanLevel === null) return "switch_plan_now";
    return STANDARD_PLAN_LEVEL[plan] > currentPlanLevel ? "upgrade_now" : "switch_at_period_end";
  };

  const getCtaLabel = (plan: TStandardPlan, interval: TCloudBillingInterval) => {
    const isCurrentSelection = isCurrentPlanSelection(
      plan,
      interval,
      currentCloudPlan,
      currentBillingInterval
    );

    if (isCurrentSelection && isTrialingWithoutPayment) {
      // Clicking this pays the full plan price now and unlocks the features excluded from the trial
      // (follow-ups, custom links) — so it's "unlock all Pro features", not "continue after trial".
      return t("workspace.settings.billing.unlock_all_plan_features", {
        plan: getCurrentCloudPlanLabel(plan, t),
      });
    }

    if (isTrialingWithoutPayment && plan === "hobby") {
      return t("workspace.settings.billing.downgrade_to_hobby");
    }

    if (isTrialingWithPayment && plan !== "hobby") {
      return t("workspace.settings.billing.upgrade_now");
    }

    if (
      canCancelCurrentPaidPlanAtPeriodEnd(
        plan,
        interval,
        currentCloudPlan,
        currentBillingInterval,
        isTrialing,
        pendingChange
      )
    ) {
      return t("workspace.settings.billing.cancel_at_period_end");
    }

    if (isCurrentSelection) {
      return t("workspace.settings.billing.current_plan_cta");
    }

    const isPendingSelection =
      pendingChange?.targetPlan === plan && (plan === "hobby" || pendingChange.targetInterval === interval);
    if (isPendingSelection) {
      return t("workspace.settings.billing.pending_plan_cta");
    }

    if (!hasPaymentMethod && plan !== "hobby") {
      return t("workspace.settings.billing.upgrade_now");
    }

    if (currentPlanLevel === null) {
      return t("workspace.settings.billing.switch_plan_now");
    }

    return STANDARD_PLAN_LEVEL[plan] > currentPlanLevel
      ? t("workspace.settings.billing.upgrade_now")
      : t("workspace.settings.billing.switch_at_period_end");
  };

  // List price for the plan/interval being confirmed, straight from the catalog — NOT from the
  // rendered planCards, which are built from the interval TOGGLE (selectedInterval) and miss
  // (interpolating "") when the modal's interval differs from the toggle.
  const getCatalogPlanAmount = (plan: Exclude<TStandardPlan, "hobby">, interval: TCloudBillingInterval) =>
    formatMoney(billingCatalog[plan][interval].currency, billingCatalog[plan][interval].unitAmount, locale);

  // Upgrade modal body: calculating placeholder, real prorated charge once previewed, or generic fallback.
  const getUpgradeConfirmationBody = () => {
    if (!upgradeConfirmation) return null;
    const plan = getCurrentCloudPlanLabel(upgradeConfirmation.plan, t);
    const period = getPlanPeriodLabel(upgradeConfirmation.plan, upgradeConfirmation.interval, t);

    if (isLoadingUpgradePreview) {
      return t("workspace.settings.billing.confirm_upgrade_calculating");
    }

    const planCardAmount = getCatalogPlanAmount(upgradeConfirmation.plan, upgradeConfirmation.interval);

    // Deliberately period-neutral ("charged {chargeNow} now"): the same modal covers a mid-cycle
    // proration (ordinary upgrade) and a full fresh period (trial conversion). The old "rest of your
    // billing period" wording was false for trial conversions on a payment-consent screen.
    if (upgradePreview) {
      return t("workspace.settings.billing.confirm_upgrade_body_with_charge", {
        plan,
        period,
        chargeNow: formatMoney(upgradePreview.currency, upgradePreview.amountDue, locale),
      });
    }

    return t("workspace.settings.billing.confirm_upgrade_body", { plan, amount: planCardAmount, period });
  };

  // Primary button label for the trial-continue modal ("Pay $X now"); falls back while previewing.
  const getTrialContinuePayNowLabel = () => {
    if (upgradePreview && !isLoadingUpgradePreview) {
      return t("workspace.settings.billing.confirm_trial_continue_pay_now", {
        chargeNow: formatMoney(upgradePreview.currency, upgradePreview.amountDue, locale),
      });
    }
    return t("workspace.settings.billing.confirm_trial_continue_pay_now_generic");
  };

  // Trial-continue modal body, rendered via <Trans> so key words can be bold. Whitespace-pre-line on
  // the modal's <div> turns the \n\n into paragraph breaks between the two bullet options.
  const renderTrialContinueBody = () => {
    if (!upgradeConfirmation) return null;
    if (isLoadingUpgradePreview) return t("workspace.settings.billing.confirm_upgrade_calculating");

    const plan = getCurrentCloudPlanLabel(upgradeConfirmation.plan, t);
    const period = getPlanPeriodLabel(upgradeConfirmation.plan, upgradeConfirmation.interval, t);
    const fullPrice = getCatalogPlanAmount(upgradeConfirmation.plan, upgradeConfirmation.interval);

    if (upgradePreview) {
      return (
        <Trans
          i18nKey="workspace.settings.billing.confirm_trial_continue_body"
          values={{
            plan,
            period,
            fullPrice,
            chargeNow: formatMoney(upgradePreview.currency, upgradePreview.amountDue, locale),
          }}
          components={{ b: <b /> }}
        />
      );
    }
    return (
      <Trans
        i18nKey="workspace.settings.billing.confirm_trial_continue_body_fallback"
        values={{ plan, period, fullPrice }}
        components={{ b: <b /> }}
      />
    );
  };

  // Shared CTA/plan-state derivation, reused by both the comparison table and the card grid.
  const getPlanCtaState = (planCard: TPlanCardData) => {
    const isCurrentSelection = isCurrentPlanSelection(
      planCard.plan,
      planCard.interval,
      currentCloudPlan,
      currentBillingInterval
    );
    const isPendingSelection =
      pendingChange?.targetPlan === planCard.plan &&
      (planCard.plan === "hobby" || pendingChange.targetInterval === planCard.interval);
    const isCancelAtPeriodEndCta = canCancelCurrentPaidPlanAtPeriodEnd(
      planCard.plan,
      planCard.interval,
      currentCloudPlan,
      currentBillingInterval,
      isTrialing,
      pendingChange
    );
    const isSwitchAtPeriodEndCtaForCard = isSwitchAtPeriodEndCta(
      planCard.plan,
      planCard.interval,
      currentCloudPlan,
      currentBillingInterval,
      currentPlanLevel,
      isTrialingWithoutPayment,
      hasPaymentMethod,
      pendingChange
    );
    const isSecondaryPlanCta = isCancelAtPeriodEndCta || isSwitchAtPeriodEndCtaForCard;
    const isDisabled =
      !hasBillingRights ||
      // A current-selection button is inert only when genuinely the active plan — during a trial
      // (with or without a card) the trialed plan stays actionable, opening the pay-now-or-keep-trial choice.
      (isCurrentSelection && !isTrialing && !isCancelAtPeriodEndCta) ||
      isPendingSelection ||
      isStripeSetupIncomplete;

    return {
      isCurrentSelection,
      isPendingSelection,
      isCancelAtPeriodEndCta,
      isSwitchAtPeriodEndCtaForCard,
      isSecondaryPlanCta,
      isDisabled,
    };
  };

  const planComparisonColumns: TPlanColumn[] = planCards.map((planCard) => {
    const { isCurrentSelection, isPendingSelection, isSecondaryPlanCta, isDisabled } =
      getPlanCtaState(planCard);

    return {
      key: `${planCard.plan}-${planCard.interval}`,
      name: getCurrentCloudPlanLabel(planCard.plan, t),
      description: planCard.description,
      amount: planCard.amount,
      periodLabel: getPlanPeriodLabel(planCard.plan, planCard.interval, t),
      isPopular: planCard.plan === "pro",
      currentBadge: isCurrentSelection,
      pendingBadge: isPendingSelection,
      mostPopularLabel: t("workspace.settings.billing.most_popular"),
      currentBadgeLabel: t("workspace.settings.billing.current_plan_badge"),
      pendingBadgeLabel: t("workspace.settings.billing.pending_plan_badge"),
      ctaLabel: getCtaLabel(planCard.plan, planCard.interval),
      ctaVariant: isSecondaryPlanCta || planCard.plan !== "pro" ? "secondary" : "default",
      ctaDisabled: isDisabled,
      ctaLoading: isPlanActionPending === `${planCard.plan}-${planCard.interval}`,
      onCtaClick: () => requestPlanAction(planCard.plan, planCard.interval),
    };
  });

  // Plan cards grid (control everywhere; mobile fallback for the comparison test variant).
  const planCardGrid = (
    <div className="grid gap-4 lg:grid-cols-3">
      {planCards.map((planCard) => {
        const { isCurrentSelection, isPendingSelection, isSecondaryPlanCta, isDisabled } =
          getPlanCtaState(planCard);

        return (
          <div
            key={`${planCard.plan}-${planCard.interval}`}
            className={cn(
              "grid h-full grid-rows-[minmax(1.75rem,auto)_minmax(8rem,auto)_minmax(4.5rem,auto)_auto_1fr] rounded-2xl border bg-white p-6 shadow-xs",
              planCard.plan === "pro" ? "border-slate-900/20" : "border-slate-200"
            )}>
            <div className="mb-4 flex min-h-7 items-start gap-2">
              {planCard.plan === "pro" && (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                  {t("workspace.settings.billing.most_popular")}
                </span>
              )}
              {isCurrentSelection && (
                <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                  {t("workspace.settings.billing.current_plan_badge")}
                </span>
              )}
              {isPendingSelection && (
                <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                  {t("workspace.settings.billing.pending_plan_badge")}
                </span>
              )}
            </div>

            <div className="min-h-32">
              <h3 className="text-3xl font-semibold text-slate-900">
                {getCurrentCloudPlanLabel(planCard.plan, t)}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">{planCard.description}</p>
            </div>

            <div className="mt-4 flex min-h-12 items-end gap-2">
              <span className="text-3xl font-normal tracking-tight text-slate-900">{planCard.amount}</span>
              <span className="pb-1 text-sm text-slate-500">
                {getPlanPeriodLabel(planCard.plan, planCard.interval, t)}
              </span>
            </div>

            <Button
              variant={isSecondaryPlanCta || planCard.plan !== "pro" ? "secondary" : "default"}
              className="mt-4 w-full"
              disabled={isDisabled}
              loading={isPlanActionPending === `${planCard.plan}-${planCard.interval}`}
              onClick={() => requestPlanAction(planCard.plan, planCard.interval)}>
              {getCtaLabel(planCard.plan, planCard.interval)}
            </Button>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <p className="mb-4 text-sm font-semibold text-slate-900">
                {t("workspace.settings.billing.this_includes")}
              </p>
              <ul className="space-y-3">
                {planCard.features.map((feature) => (
                  <li
                    key={feature.type === "text" ? feature.label : `${feature.plan}-${feature.type}`}
                    className="flex items-start gap-3 text-sm text-slate-700">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-slate-500" />
                    <span>
                      <PlanFeatureContent
                        feature={feature}
                        billingCatalog={billingCatalog}
                        selectedInterval={selectedInterval}
                        locale={locale}
                        t={t}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <main>
      <div className="flex max-w-6xl flex-col gap-4">
        {trialDaysRemaining !== null && (
          // One banner for every trial, card on file or not: features stay locked until paid, so the
          // only action is the pay-now confirm modal. Routed through requestPlanAction so the banner
          // picks the SAME modal mode as the plan card CTA (trial-continue without a card, upgrade
          // confirm with one) — identical payment-consent copy for the same conversion. The old
          // card-backed "You're all set, continues automatically" variant contradicted that model.
          <TrialAlert trialDaysRemaining={trialDaysRemaining} className="max-w-5xl">
            <AlertDescription>{t("workspace.settings.billing.trial_alert_description")}</AlertDescription>
            {hasBillingRights && trialedPaidPlan && (
              <AlertButton
                onClick={() => requestPlanAction(trialedPaidPlan, currentBillingInterval ?? "monthly")}>
                {t("workspace.settings.billing.unlock_all_plan_features", {
                  plan: getCurrentCloudPlanLabel(trialedPaidPlan, t),
                })}
              </AlertButton>
            )}
          </TrialAlert>
        )}

        {pendingChange && (
          <Alert variant="info" className="max-w-5xl" role="status">
            <AlertTitle>{t("workspace.settings.billing.pending_plan_change_title")}</AlertTitle>
            <AlertDescription>
              {t("workspace.settings.billing.pending_plan_change_description", {
                plan: getCurrentCloudPlanLabel(pendingChange.targetPlan, t),
                date: formatDateForDisplay(new Date(pendingChange.effectiveAt), locale, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                }),
              })}
            </AlertDescription>
            {hasBillingRights && (
              <AlertButton onClick={() => void undoPendingChange()} loading={isPlanActionPending === "undo"}>
                {t("workspace.settings.billing.keep_current_plan")}
              </AlertButton>
            )}
          </Alert>
        )}

        {isStripeSetupIncomplete && hasBillingRights && (
          <Alert variant="warning" className="max-w-5xl" role="status">
            <AlertTitle>{t("workspace.settings.billing.stripe_setup_incomplete")}</AlertTitle>
            <AlertDescription>
              {t("workspace.settings.billing.stripe_setup_incomplete_description")}
            </AlertDescription>
            <AlertButton onClick={() => void retryStripeSetup()} loading={isRetryingStripeSetup}>
              {t("workspace.settings.billing.retry_setup")}
            </AlertButton>
          </Alert>
        )}

        {currentCloudPlan === "custom" && (
          <Alert className="max-w-5xl" role="status">
            <AlertTitle>{t("workspace.settings.billing.custom_plan_title")}</AlertTitle>
            <AlertDescription>{t("workspace.settings.billing.custom_plan_description")}</AlertDescription>
          </Alert>
        )}

        <SettingsCard
          className="max-w-5xl"
          title={t("workspace.settings.billing.subscription")}
          description={t("workspace.settings.billing.subscription_description")}
          buttonInfo={
            canShowSubscriptionButton
              ? {
                  text: t("workspace.settings.billing.manage_billing_details"),
                  onClick: () => void openBillingPortal(),
                  variant: "secondary",
                }
              : undefined
          }>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-700">
                {t("workspace.settings.billing.your_plan")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge type="success" size="normal" text={getCurrentCloudPlanLabel(currentCloudPlan, t)} />
                {currentCloudPlan !== "hobby" && currentBillingInterval && (
                  <Badge
                    type="gray"
                    size="normal"
                    text={
                      currentBillingInterval === "monthly"
                        ? t("workspace.settings.billing.monthly")
                        : t("workspace.settings.billing.yearly")
                    }
                  />
                )}
                {currentSubscriptionStatus === "trialing" && (
                  <Badge
                    type="warning"
                    size="normal"
                    text={t("workspace.settings.billing.status_trialing")}
                  />
                )}
              </div>
              {isTrialing && trialEndLabel && (
                <p className="mt-1 text-sm text-slate-500">
                  {t("workspace.settings.billing.trial_cancels_automatically", { date: trialEndLabel })}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <UsageCard
                metric={t("common.responses")}
                currentCount={responseCount}
                limit={organization.billing.limits.monthly.responses}
                isUnlimited={responsesUnlimitedCheck}
                unlimitedLabel={t("workspace.settings.billing.unlimited_responses")}
              />
              <p className="text-sm text-slate-500">
                {t("workspace.settings.billing.usage_cycle")}: {usageCycleLabel}
              </p>
            </div>

            {workflowRunsLimit != null && (
              <UsageCard
                metric={t("common.workflow_runs")}
                currentCount={workflowRunCount}
                limit={workflowRunsLimit}
                isUnlimited={false}
                unlimitedLabel={t("workspace.settings.billing.unlimited_workflow_runs")}
              />
            )}

            <UsageCard
              metric={t("common.workspaces")}
              currentCount={workspaceCount}
              limit={organization.billing.limits.workspaces}
              isUnlimited={workspacesUnlimitedCheck}
              unlimitedLabel={t("workspace.settings.billing.unlimited_workspaces")}
            />
          </div>
        </SettingsCard>

        {showPlanSelector && (
          <SettingsCard
            className="max-w-5xl"
            title={t("workspace.settings.billing.plan_selection_title")}
            description={t("workspace.settings.billing.plan_selection_description")}>
            <div className="flex flex-col gap-6">
              <div
                className={cn(
                  "flex w-fit rounded-xl border border-slate-200 bg-slate-100 p-1",
                  isPlanComparison && "self-end"
                )}
                role="tablist"
                aria-label={t("workspace.settings.billing.billing_interval_toggle")}>
                {(["monthly", "yearly"] as const).map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    role="tab"
                    aria-selected={selectedInterval === interval}
                    tabIndex={selectedInterval === interval ? 0 : -1}
                    onClick={() => setSelectedInterval(interval)}
                    className={cn(
                      "rounded-lg px-5 py-2 text-sm font-medium transition-colors",
                      selectedInterval === interval
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:text-slate-900"
                    )}>
                    {interval === "monthly"
                      ? t("workspace.settings.billing.monthly")
                      : t("workspace.settings.billing.yearly")}
                  </button>
                ))}
              </div>

              {isPlanComparison ? (
                <>
                  <div className="lg:hidden">{planCardGrid}</div>
                  <div className="hidden lg:block">
                    <PlanComparisonTable columns={planComparisonColumns} />
                  </div>
                </>
              ) : (
                planCardGrid
              )}

              <div className="mt-4 flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {t("workspace.settings.billing.contact_sales_title")}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {t("workspace.settings.billing.contact_sales_description")}
                  </p>
                </div>
                <Button variant="default" className="shrink-0" asChild>
                  <Link
                    href="https://app.formbricks.com/s/trvp8tzy5uvsps9rc9qi9l9w?delivery=cloud&source=billingView"
                    target="_blank"
                    rel="noopener noreferrer">
                    {t("workspace.settings.billing.contact_sales_cta")}
                  </Link>
                </Button>
              </div>
            </div>
          </SettingsCard>
        )}
      </div>

      {upgradeConfirmation?.mode === "trial-continue" && (
        <ConfirmationModal
          open
          setOpen={(value) => {
            if (!value) closeUpgradeConfirmation();
          }}
          title={t("workspace.settings.billing.confirm_trial_continue_title", {
            plan: getCurrentCloudPlanLabel(upgradeConfirmation.plan, t),
          })}
          description={t("workspace.settings.billing.confirm_trial_continue_description")}
          body={renderTrialContinueBody()}
          buttonText={getTrialContinuePayNowLabel()}
          buttonVariant="default"
          buttonLoading={isLoadingUpgradePreview}
          isButtonDisabled={isLoadingUpgradePreview}
          cancelButtonText={t("common.cancel")}
          onConfirm={() => {
            const { plan, interval } = upgradeConfirmation;
            closeUpgradeConfirmation();
            handleTrialPayNow(plan, interval);
          }}
        />
      )}

      {upgradeConfirmation?.mode === "upgrade" && (
        <ConfirmationModal
          open
          setOpen={(value) => {
            if (!value) closeUpgradeConfirmation();
          }}
          title={t("workspace.settings.billing.confirm_upgrade_title")}
          description={t("workspace.settings.billing.confirm_upgrade_description")}
          body={getUpgradeConfirmationBody()}
          buttonText={t("workspace.settings.billing.confirm_upgrade_button")}
          buttonVariant="default"
          buttonLoading={isLoadingUpgradePreview}
          isButtonDisabled={isLoadingUpgradePreview}
          cancelButtonText={t("common.cancel")}
          onConfirm={() => {
            const { plan, interval } = upgradeConfirmation;
            closeUpgradeConfirmation();
            void handlePlanAction(plan, interval);
          }}
        />
      )}

      {isHobbyDowngradeConfirmOpen && (
        <ConfirmationModal
          open
          setOpen={(value) => {
            if (!value) setIsHobbyDowngradeConfirmOpen(false);
          }}
          title={t("workspace.settings.billing.confirm_hobby_downgrade_title")}
          description={t("workspace.settings.billing.confirm_hobby_downgrade_description")}
          body={t("workspace.settings.billing.confirm_hobby_downgrade_body", {
            plan: getCurrentCloudPlanLabel(currentCloudPlan, t),
          })}
          buttonText={t("workspace.settings.billing.downgrade_to_hobby")}
          buttonVariant="destructive"
          cancelButtonText={t("common.cancel")}
          onConfirm={() => {
            setIsHobbyDowngradeConfirmOpen(false);
            void handlePlanAction("hobby", "monthly");
          }}
        />
      )}
    </main>
  );
};
