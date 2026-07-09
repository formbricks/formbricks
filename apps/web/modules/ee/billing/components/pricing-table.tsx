"use client";

import { type Stripe as StripeJs, loadStripe } from "@stripe/stripe-js";
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
  waitForBillingPlanAction,
} from "../actions";
import type { TStripeBillingCatalogDisplay } from "../lib/stripe-billing-catalog";
import { PlanComparisonTable, type TPlanColumn } from "./plan-comparison";
import { PlanResponseFeature } from "./response-pricing-tooltip";
import { TrialAlert } from "./trial-alert";
import { UsageCard } from "./usage-card";

const BILLING_CONFIRMATION_ORGANIZATION_ID_KEY = "billingConfirmationOrganizationId";
const BILLING_PENDING_UPGRADE_PLAN_KEY = "billingPendingUpgradePlan";
const BILLING_PENDING_UPGRADE_INTERVAL_KEY = "billingPendingUpgradeInterval";

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

type TPlanFeature = { type: "text"; label: string } | { type: "responses"; plan: "pro" | "scale" };

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
  isTrialingWithoutPayment: boolean,
  pendingChange: TOrganizationStripePendingChange | null
) =>
  plan !== "hobby" &&
  !isTrialingWithoutPayment &&
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

export const PricingTable = ({
  organization,
  responseCount,
  workspaceCount,
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
  const [isRetryingStripeSetup, setIsRetryingStripeSetup] = useState(false);
  const [isPlanActionPending, setIsPlanActionPending] = useState<string | null>(null);
  // Set when an immediate, in-place upgrade charge needs explicit confirmation before it runs.
  const [upgradeConfirmation, setUpgradeConfirmation] = useState<{
    plan: Exclude<TStandardPlan, "hobby">;
    interval: TCloudBillingInterval;
  } | null>(null);
  // Prorated amount Stripe would charge now for the pending upgrade confirmation, fetched lazily.
  const [upgradePreview, setUpgradePreview] = useState<{ amountDue: number; currency: string } | null>(null);
  const [isLoadingUpgradePreview, setIsLoadingUpgradePreview] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<TCloudBillingInterval>(
    currentBillingInterval ?? "monthly"
  );

  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const isTrialing = currentSubscriptionStatus === "trialing";
  const hasPaymentMethod = organization.billing.stripe?.hasPaymentMethod === true;
  const existingSubscriptionId = organization.billing.stripe?.subscriptionId ?? null;
  const canShowSubscriptionButton = hasBillingRights && !!organization.billing.stripeCustomerId;
  const isTrialingWithoutPayment = isTrialing && !hasPaymentMethod;
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

  useEffect(() => {
    if (searchParams.get("checkout_success") !== "1") {
      return;
    }

    if (searchParams.get("upgrade_pending") !== "1") {
      const timer = setTimeout(() => router.refresh(), 2500);
      return () => clearTimeout(timer);
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

    upgradeDriveRef.current = true;
    let cancelled = false;
    const toastId = toast.loading(t("workspace.settings.billing.upgrade_checkout_pending"));

    const finish = (
      kind: "success" | "error",
      plan: Exclude<TStandardPlan, "hobby"> | null,
      message?: string
    ) => {
      toast.dismiss(toastId);
      if (kind === "success") {
        toast.success(
          t("workspace.settings.billing.upgrade_checkout_success", {
            plan: getCurrentCloudPlanLabel(plan ?? "pro", t),
          })
        );
      } else {
        toast.error(message ?? t("common.something_went_wrong_please_try_again"));
      }
      clearUpgradeIntent();
      router.replace(`/organizations/${organizationId}/settings/billing`);
      router.refresh();
    };

    const run = async () => {
      // Finalize attaches the card and applies the upgrade in one call, so it never races the webhook.
      const response = await finalizeSetupCheckoutUpgradeAction({ organizationId, checkoutSessionId });
      if (cancelled) return;

      if (response?.serverError) {
        finish("error", pendingPlan, getActionErrorMessage(response.serverError, t));
        return;
      }

      const resolvedPlan =
        (response?.data && "targetPlan" in response.data ? response.data.targetPlan : null) ?? pendingPlan;

      if (response?.data) {
        const settled = await settleUpgradeConfirmation(response.data);
        if (cancelled) return;
        if (!settled.applied) {
          finish("error", resolvedPlan, settled.message ?? undefined);
          return;
        }
      }

      if (resolvedPlan) {
        await waitForBillingPlanAction({ organizationId, targetPlan: resolvedPlan });
        if (cancelled) return;
      }
      finish("success", resolvedPlan);
    };

    void run();

    return () => {
      cancelled = true;
      toast.dismiss(toastId);
    };
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

  const openTrialPaymentCheckout = async () => {
    try {
      persistOrganizationId();
      const response = await createTrialPaymentCheckoutAction({ organizationId });
      if (response?.serverError) {
        toast.error(getActionErrorMessage(response.serverError, t));
        return;
      }
      if (response?.data && typeof response.data === "string") {
        navigateToExternalUrl(response.data);
        return;
      }
      toast.error(t("common.something_went_wrong_please_try_again"));
    } catch (error) {
      console.error("Failed to create setup checkout session:", error);
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
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
        if (
          isTrialingWithoutPayment &&
          isCurrentPlanSelection(plan, interval, currentCloudPlan, currentBillingInterval)
        ) {
          await openTrialPaymentCheckout();
          return;
        }

        await redirectToPlanCheckout(plan, interval);
        return;
      }

      if (
        canCancelCurrentPaidPlanAtPeriodEnd(
          plan,
          interval,
          currentCloudPlan,
          currentBillingInterval,
          isTrialingWithoutPayment,
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
          await waitForBillingPlanAction({ organizationId, targetPlan: plan });
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

  // True only for the in-place upgrade that charges the card immediately (the path with no prior confirmation).
  const willChargeImmediately = (plan: TStandardPlan, interval: TCloudBillingInterval): boolean =>
    hasPaymentMethod &&
    plan !== "hobby" &&
    currentPlanLevel !== null &&
    STANDARD_PLAN_LEVEL[plan] > currentPlanLevel &&
    !isCurrentPlanSelection(plan, interval, currentCloudPlan, currentBillingInterval) &&
    !canCancelCurrentPaidPlanAtPeriodEnd(
      plan,
      interval,
      currentCloudPlan,
      currentBillingInterval,
      isTrialingWithoutPayment,
      pendingChange
    );

  // Gate the immediate-charge upgrade behind a confirmation modal; everything else runs as before.
  const requestPlanAction = (plan: TStandardPlan, interval: TCloudBillingInterval) => {
    if (plan !== "hobby" && willChargeImmediately(plan, interval)) {
      setUpgradeConfirmation({ plan, interval });
      // Fetch the prorated charge to show in the modal. On failure we fall back to the generic copy.
      setUpgradePreview(null);
      setIsLoadingUpgradePreview(true);
      getUpgradeChargePreviewAction({ organizationId, targetPlan: plan, targetInterval: interval })
        .then((response) => setUpgradePreview(response?.data ?? null))
        .catch(() => setUpgradePreview(null))
        .finally(() => setIsLoadingUpgradePreview(false));
      return;
    }
    void handlePlanAction(plan, interval);
  };

  const closeUpgradeConfirmation = () => {
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

    if (isCurrentSelection && isTrialingWithoutPayment) return "continue_with_plan_after_trial";
    if (isTrialingWithoutPayment && plan === "hobby") return "downgrade_to_hobby";
    if (
      canCancelCurrentPaidPlanAtPeriodEnd(
        plan,
        interval,
        currentCloudPlan,
        currentBillingInterval,
        isTrialingWithoutPayment,
        pendingChange
      )
    )
      return "cancel_at_period_end";
    if (isCurrentSelection && pendingChange?.targetPlan === "hobby") return "pending_plan_cta";
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
      return t("workspace.settings.billing.continue_with_plan_after_trial");
    }

    if (isTrialingWithoutPayment && plan === "hobby") {
      return t("workspace.settings.billing.downgrade_to_hobby");
    }

    if (
      canCancelCurrentPaidPlanAtPeriodEnd(
        plan,
        interval,
        currentCloudPlan,
        currentBillingInterval,
        isTrialingWithoutPayment,
        pendingChange
      )
    ) {
      return t("workspace.settings.billing.cancel_at_period_end");
    }

    if (isCurrentSelection && pendingChange?.targetPlan === "hobby") {
      return t("workspace.settings.billing.pending_plan_cta");
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

  // Upgrade modal body: calculating placeholder, real prorated charge once previewed, or generic fallback.
  const getUpgradeConfirmationBody = () => {
    if (!upgradeConfirmation) return "";
    const plan = getCurrentCloudPlanLabel(upgradeConfirmation.plan, t);
    const period = getPlanPeriodLabel(upgradeConfirmation.plan, upgradeConfirmation.interval, t);

    if (isLoadingUpgradePreview) {
      return t("workspace.settings.billing.confirm_upgrade_calculating");
    }

    if (upgradePreview) {
      return t("workspace.settings.billing.confirm_upgrade_body_with_charge", {
        plan,
        period,
        chargeNow: formatMoney(upgradePreview.currency, upgradePreview.amountDue, locale),
      });
    }

    const amount =
      planCards.find(
        (card) => card.plan === upgradeConfirmation.plan && card.interval === upgradeConfirmation.interval
      )?.amount ?? "";
    return t("workspace.settings.billing.confirm_upgrade_body", { plan, amount, period });
  };

  // Plan columns for the comparison table (test variant), reusing the same CTA state as the cards.
  // Shared CTA/plan-state derivation used by both the comparison table and the card grid.
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
      isTrialingWithoutPayment,
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
      (isCurrentSelection && !isTrialingWithoutPayment && !isCancelAtPeriodEndCta) ||
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
                    key={feature.type === "text" ? feature.label : `${feature.plan}-responses`}
                    className="flex items-start gap-3 text-sm text-slate-700">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-slate-500" />
                    <span>
                      {feature.type === "text" ? (
                        feature.label
                      ) : (
                        <PlanResponseFeature
                          plan={feature.plan}
                          locale={locale}
                          overage={billingCatalog[feature.plan][selectedInterval].responseOverage}
                          t={t}
                        />
                      )}
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
        {trialDaysRemaining !== null &&
          (hasPaymentMethod ? (
            <TrialAlert trialDaysRemaining={trialDaysRemaining} hasPaymentMethod className="max-w-5xl">
              <AlertDescription>
                {t("workspace.settings.billing.trial_payment_method_added_description")}
              </AlertDescription>
            </TrialAlert>
          ) : (
            <TrialAlert trialDaysRemaining={trialDaysRemaining} className="max-w-5xl">
              <AlertDescription>{t("workspace.settings.billing.trial_alert_description")}</AlertDescription>
              {hasBillingRights && (
                <AlertButton onClick={() => void openTrialPaymentCheckout()}>
                  {t("workspace.settings.billing.continue_with_plan_after_trial")}
                </AlertButton>
              )}
            </TrialAlert>
          ))}

        {pendingChange && (
          <Alert variant="info" className="max-w-5xl">
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
          <Alert variant="warning" className="max-w-5xl">
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
          <Alert className="max-w-5xl">
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

      {upgradeConfirmation && (
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
    </main>
  );
};
