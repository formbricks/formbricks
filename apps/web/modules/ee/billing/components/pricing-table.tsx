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
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import {
  changeBillingPlanAction,
  createPlanCheckoutAction,
  createTrialPaymentCheckoutAction,
  manageSubscriptionAction,
  retryStripeSetupAction,
  undoPendingPlanChangeAction,
} from "../actions";
import type { TStripeBillingCatalogDisplay } from "../lib/stripe-billing-catalog";
import { TrialAlert } from "./trial-alert";
import { UsageCard } from "./usage-card";

const BILLING_CONFIRMATION_ENVIRONMENT_ID_KEY = "billingConfirmationEnvironmentId";

type TDisplayPlan = "hobby" | "pro" | "scale" | "custom" | "unknown";
type TStandardPlan = "hobby" | "pro" | "scale";

interface PricingTableProps {
  organization: TOrganization;
  environmentId: string;
  responseCount: number;
  projectCount: number;
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
  if (plan === "hobby") return t("environments.settings.billing.plan_hobby");
  if (plan === "pro") return t("environments.settings.billing.plan_pro");
  if (plan === "scale") return t("environments.settings.billing.plan_scale");
  if (plan === "custom") return t("environments.settings.billing.plan_custom");
  return t("environments.settings.billing.plan_unknown");
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

const formatDate = (date: Date, locale: string) =>
  date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

type TPlanCardData = {
  plan: TStandardPlan;
  interval: TCloudBillingInterval;
  amount: string;
  description: string;
  features: string[];
};

const getPlanPeriodLabel = (
  plan: TStandardPlan,
  interval: TCloudBillingInterval,
  t: (key: string) => string
) => {
  if (plan === "hobby" || interval === "monthly") {
    return t("environments.settings.billing.per_month");
  }

  return t("environments.settings.billing.per_year");
};

const getPlanChangePayload = (environmentId: string, plan: TStandardPlan, interval: TCloudBillingInterval) =>
  plan === "hobby"
    ? {
        environmentId,
        targetPlan: "hobby" as const,
        targetInterval: "monthly" as const,
      }
    : {
        environmentId,
        targetPlan: plan,
        targetInterval: interval,
      };

const getPlanChangeSuccessMessage = (
  mode: "immediate" | "scheduled" | undefined,
  t: (key: string) => string
) => {
  if (mode === "scheduled") {
    return t("environments.settings.billing.plan_change_scheduled");
  }

  return t("environments.settings.billing.plan_change_applied");
};

const getActionErrorMessage = (serverError: string, t: (key: string) => string) => {
  if (serverError === "mixed_interval_checkout_unsupported") {
    return t("environments.settings.billing.yearly_checkout_unavailable");
  }

  return t("common.something_went_wrong_please_try_again");
};

export const PricingTable = ({
  environmentId,
  organization,
  responseCount,
  projectCount,
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
  const showPlanSelector = !isStripeSetupIncomplete && (!isTrialing || hasPaymentMethod);
  const usageCycleLabel = `${formatDate(usageCycleStart, locale)} - ${formatDate(usageCycleEnd, locale)}`;
  const responsesUnlimitedCheck = organization.billing.limits.monthly.responses === null;
  const projectsUnlimitedCheck = organization.billing.limits.projects === null;
  const currentPlanLevel =
    currentCloudPlan === "hobby" || currentCloudPlan === "pro" || currentCloudPlan === "scale"
      ? STANDARD_PLAN_LEVEL[currentCloudPlan]
      : null;

  useEffect(() => {
    if (searchParams.get("checkout_success")) {
      const timer = setTimeout(() => router.refresh(), 2500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

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
        description: t("environments.settings.billing.plan_hobby_description"),
        features: [
          t("environments.settings.billing.plan_hobby_feature_workspaces"),
          t("environments.settings.billing.plan_hobby_feature_responses"),
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
        description: t("environments.settings.billing.plan_pro_description"),
        features: [
          t("environments.settings.billing.plan_feature_everything_in_hobby"),
          t("environments.settings.billing.plan_pro_feature_workspaces"),
          t("environments.settings.billing.plan_pro_feature_responses"),
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
        description: t("environments.settings.billing.plan_scale_description"),
        features: [
          t("environments.settings.billing.plan_feature_everything_in_pro"),
          t("environments.settings.billing.plan_scale_feature_workspaces"),
          t("environments.settings.billing.plan_scale_feature_responses"),
        ],
      },
    ];
  }, [billingCatalog, locale, selectedInterval, t]);

  const persistEnvironmentId = () => {
    if (globalThis.window !== undefined) {
      globalThis.window.sessionStorage.setItem(BILLING_CONFIRMATION_ENVIRONMENT_ID_KEY, environmentId);
    }
  };

  const navigateToExternalUrl = (url: string) => {
    if (globalThis.window !== undefined) {
      globalThis.window.location.href = url;
    }
  };

  const openBillingPortal = async () => {
    const response = await manageSubscriptionAction({ environmentId });
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
      persistEnvironmentId();
      const response = await createTrialPaymentCheckoutAction({ environmentId });
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
      await openTrialPaymentCheckout();
      return;
    }

    if (interval === "yearly") {
      toast.error(t("environments.settings.billing.yearly_checkout_unavailable"));
      return;
    }

    persistEnvironmentId();
    const response = await createPlanCheckoutAction({
      environmentId,
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
        await redirectToPlanCheckout(plan, interval);
        return;
      }

      const response = await changeBillingPlanAction(getPlanChangePayload(environmentId, plan, interval));
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
      const response = await undoPendingPlanChangeAction({ environmentId });
      if (response?.serverError) {
        toast.error(getActionErrorMessage(response.serverError, t));
        return;
      }
      if (response?.data) {
        toast.success(t("environments.settings.billing.pending_change_removed"));
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
    const isCurrentSelection =
      currentCloudPlan === plan && (plan === "hobby" || currentBillingInterval === interval);
    if (isCurrentSelection) {
      return t("environments.settings.billing.current_plan_cta");
    }

    const isPendingSelection =
      pendingChange?.targetPlan === plan && (plan === "hobby" || pendingChange.targetInterval === interval);
    if (isPendingSelection) {
      return t("environments.settings.billing.pending_plan_cta");
    }

    if (!hasPaymentMethod && plan !== "hobby") {
      return t("environments.settings.billing.upgrade_now");
    }

    if (currentPlanLevel === null) {
      return t("environments.settings.billing.switch_plan_now");
    }

    return STANDARD_PLAN_LEVEL[plan] > currentPlanLevel
      ? t("environments.settings.billing.upgrade_now")
      : t("environments.settings.billing.switch_at_period_end");
  };

  return (
    <main>
      <div className="flex max-w-6xl flex-col gap-4">
        {trialDaysRemaining !== null &&
          (hasPaymentMethod ? (
            <TrialAlert trialDaysRemaining={trialDaysRemaining} hasPaymentMethod>
              <AlertDescription>
                {t("environments.settings.billing.trial_payment_method_added_description")}
              </AlertDescription>
            </TrialAlert>
          ) : (
            <TrialAlert trialDaysRemaining={trialDaysRemaining}>
              <AlertDescription>
                {t("environments.settings.billing.trial_alert_description")}
              </AlertDescription>
              {hasBillingRights && (
                <AlertButton onClick={() => void openTrialPaymentCheckout()}>
                  {t("environments.settings.billing.add_payment_method")}
                </AlertButton>
              )}
            </TrialAlert>
          ))}

        {pendingChange && (
          <Alert variant="info" className="max-w-4xl">
            <AlertTitle>{t("environments.settings.billing.pending_plan_change_title")}</AlertTitle>
            <AlertDescription>
              {t("environments.settings.billing.pending_plan_change_description")
                .replace("{{plan}}", getCurrentCloudPlanLabel(pendingChange.targetPlan, t))
                .replace("{{date}}", formatDate(new Date(pendingChange.effectiveAt), locale))}
            </AlertDescription>
            {hasBillingRights && (
              <AlertButton onClick={() => void undoPendingChange()} loading={isPlanActionPending === "undo"}>
                {t("environments.settings.billing.keep_current_plan")}
              </AlertButton>
            )}
          </Alert>
        )}

        {isStripeSetupIncomplete && hasBillingRights && (
          <Alert variant="warning">
            <AlertTitle>{t("environments.settings.billing.stripe_setup_incomplete")}</AlertTitle>
            <AlertDescription>
              {t("environments.settings.billing.stripe_setup_incomplete_description")}
            </AlertDescription>
            <AlertButton onClick={() => void retryStripeSetup()} loading={isRetryingStripeSetup}>
              {t("environments.settings.billing.retry_setup")}
            </AlertButton>
          </Alert>
        )}

        {currentCloudPlan === "custom" && (
          <Alert>
            <AlertTitle>{t("environments.settings.billing.custom_plan_title")}</AlertTitle>
            <AlertDescription>{t("environments.settings.billing.custom_plan_description")}</AlertDescription>
          </Alert>
        )}

        <SettingsCard
          title={t("environments.settings.billing.subscription")}
          description={t("environments.settings.billing.subscription_description")}
          buttonInfo={
            canShowSubscriptionButton
              ? {
                  text: hasPaymentMethod
                    ? t("environments.settings.billing.manage_billing_details")
                    : t("environments.settings.billing.add_payment_method"),
                  onClick: () => void (hasPaymentMethod ? openBillingPortal() : openTrialPaymentCheckout()),
                  variant: "default",
                }
              : undefined
          }>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-700">
                {t("environments.settings.billing.your_plan")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge type="success" size="normal" text={getCurrentCloudPlanLabel(currentCloudPlan, t)} />
                {currentCloudPlan !== "hobby" && currentBillingInterval && (
                  <Badge
                    type="gray"
                    size="normal"
                    text={
                      currentBillingInterval === "monthly"
                        ? t("environments.settings.billing.monthly")
                        : t("environments.settings.billing.yearly")
                    }
                  />
                )}
                {currentSubscriptionStatus === "trialing" && (
                  <Badge
                    type="warning"
                    size="normal"
                    text={t("environments.settings.billing.status_trialing")}
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
                unlimitedLabel={t("environments.settings.billing.unlimited_responses")}
              />
              <p className="text-sm text-slate-500">
                {t("environments.settings.billing.usage_cycle")}: {usageCycleLabel}
              </p>
            </div>

            <UsageCard
              metric={t("common.workspaces")}
              currentCount={projectCount}
              limit={organization.billing.limits.projects}
              isUnlimited={projectsUnlimitedCheck}
              unlimitedLabel={t("environments.settings.billing.unlimited_workspaces")}
            />
          </div>
        </SettingsCard>

        {showPlanSelector && (
          <SettingsCard
            title={t("environments.settings.billing.plan_selection_title")}
            description={t("environments.settings.billing.plan_selection_description")}>
            <div className="flex flex-col gap-6">
              <div
                className="flex w-fit rounded-xl border border-slate-200 bg-slate-100 p-1"
                role="tablist"
                aria-label={t("environments.settings.billing.billing_interval_toggle")}>
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
                      ? t("environments.settings.billing.monthly")
                      : t("environments.settings.billing.yearly")}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {planCards.map((planCard) => {
                  const isCurrentSelection =
                    currentCloudPlan === planCard.plan &&
                    (planCard.plan === "hobby" || currentBillingInterval === planCard.interval);
                  const isPendingSelection =
                    pendingChange?.targetPlan === planCard.plan &&
                    (planCard.plan === "hobby" || pendingChange.targetInterval === planCard.interval);
                  const isMissingPaymentMethodUpgrade =
                    hasBillingRights &&
                    !isStripeSetupIncomplete &&
                    !isTrialing &&
                    !isCurrentSelection &&
                    !isPendingSelection &&
                    !hasPaymentMethod &&
                    planCard.plan !== "hobby";
                  const isDisabled =
                    !hasBillingRights ||
                    isCurrentSelection ||
                    isPendingSelection ||
                    isStripeSetupIncomplete ||
                    isMissingPaymentMethodUpgrade ||
                    (isTrialing && !hasPaymentMethod);

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
                            {t("environments.settings.billing.most_popular")}
                          </span>
                        )}
                        {isCurrentSelection && (
                          <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                            {t("environments.settings.billing.current_plan_badge")}
                          </span>
                        )}
                        {isPendingSelection && (
                          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                            {t("environments.settings.billing.pending_plan_badge")}
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

                      <TooltipRenderer
                        shouldRender={isMissingPaymentMethodUpgrade}
                        triggerClass="block w-full"
                        tooltipContent={t(
                          "environments.settings.billing.add_payment_method_to_upgrade_tooltip"
                        )}>
                        <Button
                          variant="secondary"
                          className="mt-4 w-full"
                          disabled={isDisabled}
                          loading={isPlanActionPending === `${planCard.plan}-${planCard.interval}`}
                          onClick={() => void handlePlanAction(planCard.plan, planCard.interval)}>
                          {getCtaLabel(planCard.plan, planCard.interval)}
                        </Button>
                      </TooltipRenderer>

                      <div className="mt-8 border-t border-slate-100 pt-6">
                        <p className="mb-4 text-sm font-semibold text-slate-900">
                          {t("environments.settings.billing.this_includes")}
                        </p>
                        <ul className="space-y-3">
                          {planCard.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-3 text-sm text-slate-700">
                              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                              <span>{feature}</span>
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
