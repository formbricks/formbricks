"use client";

import { CheckIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  type TCloudBillingInterval,
  type TOrganization,
  type TOrganizationStripePendingChange,
  type TOrganizationStripeSubscriptionStatus,
} from "@formbricks/types/organizations";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  changeBillingPlanAction,
  createPlanCheckoutAction,
  createTrialPaymentCheckoutAction,
  manageSubscriptionAction,
  retryStripeSetupAction,
  undoPendingPlanChangeAction,
} from "../actions";
import type { TStripeBillingCatalogDisplay } from "../lib/stripe-billing-catalog";
import { PlanResponseFeature } from "./response-pricing-tooltip";
import { TrialAlert } from "./trial-alert";
import { UsageCard } from "./usage-card";

const BILLING_CONFIRMATION_WORKSPACE_ID_KEY = "billingConfirmationWorkspaceId";
const BILLING_PENDING_UPGRADE_PLAN_KEY = "billingPendingUpgradePlan";
const BILLING_PENDING_UPGRADE_INTERVAL_KEY = "billingPendingUpgradeInterval";
const UPGRADE_CHECKOUT_POLL_INTERVAL_MS = 2000;
const UPGRADE_CHECKOUT_POLL_TIMEOUT_MS = 30000;

type TDisplayPlan = "hobby" | "pro" | "scale" | "custom" | "unknown";
type TStandardPlan = "hobby" | "pro" | "scale";

interface PricingTableProps {
  organization: TOrganization;
  workspaceId: string;
  responseCount: number;
  workspaceCount: number;
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

const getPlanChangePayload = (workspaceId: string, plan: TStandardPlan, interval: TCloudBillingInterval) =>
  plan === "hobby"
    ? {
        workspaceId,
        targetPlan: "hobby" as const,
        targetInterval: "monthly" as const,
      }
    : {
        workspaceId,
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
  workspaceId,
  organization,
  responseCount,
  workspaceCount,
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
}: PricingTableProps) => {
  const { t, i18n } = useTranslation();
  const { workspace } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRetryingStripeSetup, setIsRetryingStripeSetup] = useState(false);
  const [isPlanActionPending, setIsPlanActionPending] = useState<string | null>(null);
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

  useEffect(() => {
    if (searchParams.get("checkout_success") !== "1") {
      return;
    }

    if (searchParams.get("upgrade_pending") === "1") {
      const toastId = toast.loading(t("workspace.settings.billing.upgrade_checkout_pending"));
      const pollInterval = setInterval(() => router.refresh(), UPGRADE_CHECKOUT_POLL_INTERVAL_MS);
      const pollTimeout = setTimeout(() => {
        clearInterval(pollInterval);
        toast.dismiss(toastId);
        clearUpgradeIntent();
      }, UPGRADE_CHECKOUT_POLL_TIMEOUT_MS);

      return () => {
        clearInterval(pollInterval);
        clearTimeout(pollTimeout);
        toast.dismiss(toastId);
      };
    }

    const timer = setTimeout(() => router.refresh(), 2500);
    return () => clearTimeout(timer);
  }, [searchParams, router, t]);

  useEffect(() => {
    if (searchParams.get("checkout_success") !== "1" || searchParams.get("upgrade_pending") !== "1") {
      return;
    }

    if (globalThis.window === undefined) {
      return;
    }

    const pendingPlan = globalThis.window.sessionStorage.getItem(BILLING_PENDING_UPGRADE_PLAN_KEY) as Exclude<
      TStandardPlan,
      "hobby"
    > | null;
    if (!pendingPlan) {
      return;
    }

    const pendingInterval = globalThis.window.sessionStorage.getItem(
      BILLING_PENDING_UPGRADE_INTERVAL_KEY
    ) as TCloudBillingInterval | null;
    const planMatches = currentCloudPlan === pendingPlan && currentBillingInterval === pendingInterval;

    if (!planMatches) {
      return;
    }

    toast.success(
      t("workspace.settings.billing.upgrade_checkout_success", {
        plan: getCurrentCloudPlanLabel(pendingPlan, t),
      })
    );
    clearUpgradeIntent();
    router.replace(`/workspaces/${workspaceId}/settings/organization/billing`);
  }, [currentBillingInterval, currentCloudPlan, router, searchParams, t, workspaceId]);

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

  const persistWorkspaceId = () => {
    if (globalThis.window !== undefined) {
      if (workspace?.id) {
        globalThis.window.sessionStorage.setItem(BILLING_CONFIRMATION_WORKSPACE_ID_KEY, workspace.id);
      }
    }
  };

  const navigateToExternalUrl = (url: string) => {
    if (globalThis.window !== undefined) {
      globalThis.window.location.href = url;
    }
  };

  const openBillingPortal = async () => {
    const response = await manageSubscriptionAction({ workspaceId });
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
      persistWorkspaceId();
      const response = await createTrialPaymentCheckoutAction({ workspaceId });
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
      persistWorkspaceId();
      persistUpgradeIntent(plan, interval);
      const response = await createTrialPaymentCheckoutAction({
        workspaceId,
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

    persistWorkspaceId();
    const response = await createPlanCheckoutAction({
      workspaceId,
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
        const response = await changeBillingPlanAction(getPlanChangePayload(workspaceId, "hobby", "monthly"));
        if (response?.serverError) {
          toast.error(getActionErrorMessage(response.serverError, t));
          return;
        }
        toast.success(getPlanChangeSuccessMessage(response?.data?.mode, t));
        router.refresh();
        return;
      }

      const response = await changeBillingPlanAction(getPlanChangePayload(workspaceId, plan, interval));
      if (response?.serverError) {
        toast.error(getActionErrorMessage(response.serverError, t));
        return;
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

  const undoPendingChange = async () => {
    setIsPlanActionPending("undo");
    try {
      const response = await undoPendingPlanChangeAction({ workspaceId });
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

  return (
    <main>
      <div className="flex max-w-6xl flex-col gap-4">
        {trialDaysRemaining !== null &&
          (hasPaymentMethod ? (
            <TrialAlert trialDaysRemaining={trialDaysRemaining} hasPaymentMethod>
              <AlertDescription>
                {t("workspace.settings.billing.trial_payment_method_added_description")}
              </AlertDescription>
            </TrialAlert>
          ) : (
            <TrialAlert trialDaysRemaining={trialDaysRemaining}>
              <AlertDescription>
                {t("workspace.settings.billing.trial_alert_description", {
                  price: formatMoney(
                    billingCatalog.pro.monthly.currency,
                    billingCatalog.pro.monthly.unitAmount,
                    locale
                  ),
                })}
              </AlertDescription>
              {hasBillingRights && (
                <AlertButton onClick={() => void openTrialPaymentCheckout()}>
                  {t("workspace.settings.billing.continue_with_plan_after_trial")}
                </AlertButton>
              )}
            </TrialAlert>
          ))}

        {pendingChange && (
          <Alert variant="info" className="max-w-4xl">
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
          <Alert variant="warning" className="max-w-4xl">
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
          <Alert className="max-w-4xl">
            <AlertTitle>{t("workspace.settings.billing.custom_plan_title")}</AlertTitle>
            <AlertDescription>{t("workspace.settings.billing.custom_plan_description")}</AlertDescription>
          </Alert>
        )}

        <SettingsCard
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
            title={t("workspace.settings.billing.plan_selection_title")}
            description={t("workspace.settings.billing.plan_selection_description")}>
            <div className="flex flex-col gap-6">
              <div
                className="flex w-fit rounded-xl border border-slate-200 bg-slate-100 p-1"
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

              <div className="grid gap-4 lg:grid-cols-3">
                {planCards.map((planCard) => {
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

                  return (
                    <div
                      key={`${planCard.plan}-${planCard.interval}`}
                      className={cn(
                        "grid h-full grid-rows-[minmax(1.75rem,auto)_minmax(8rem,auto)_minmax(4.5rem,auto)_auto_1fr] rounded-2xl border bg-white p-6 shadow-sm",
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

                      <div className="mt-4 flex min-h-[3rem] items-end gap-2">
                        <span className="text-3xl font-normal tracking-tight text-slate-900">
                          {planCard.amount}
                        </span>
                        <span className="pb-1 text-sm text-slate-500">
                          {getPlanPeriodLabel(planCard.plan, planCard.interval, t)}
                        </span>
                      </div>

                      <Button
                        variant={isSecondaryPlanCta || planCard.plan !== "pro" ? "secondary" : "default"}
                        className="mt-4 w-full"
                        disabled={isDisabled}
                        loading={isPlanActionPending === `${planCard.plan}-${planCard.interval}`}
                        onClick={() => void handlePlanAction(planCard.plan, planCard.interval)}>
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
            </div>
          </SettingsCard>
        )}
      </div>
    </main>
  );
};
