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
import {
  changeBillingPlanAction,
  createPlanCheckoutAction,
  createTrialPaymentCheckoutAction,
  manageSubscriptionAction,
  retryStripeSetupAction,
  undoPendingPlanChangeAction,
} from "../actions";
import { TrialAlert } from "./trial-alert";
import { UsageCard } from "./usage-card";

const BILLING_CONFIRMATION_ENVIRONMENT_ID_KEY = "billingConfirmationEnvironmentId";

type TDisplayPlan = "hobby" | "pro" | "scale" | "custom" | "unknown";

type TBillingCatalogDisplay = {
  hobby: {
    monthly: {
      currency: string;
      unitAmount: number | null;
    };
  };
  pro: {
    monthly: {
      currency: string;
      unitAmount: number | null;
    };
    yearly: {
      currency: string;
      unitAmount: number | null;
    };
  };
  scale: {
    monthly: {
      currency: string;
      unitAmount: number | null;
    };
    yearly: {
      currency: string;
      unitAmount: number | null;
    };
  };
};

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
  billingCatalog: TBillingCatalogDisplay;
}

const STANDARD_PLAN_LEVEL: Record<"hobby" | "pro" | "scale", number> = {
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
  plan: "hobby" | "pro" | "scale";
  interval: TCloudBillingInterval;
  amount: string;
  description: string;
  features: string[];
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
  const canManageBillingDetails = hasBillingRights && !!organization.billing.stripeCustomerId;
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

  const openBillingPortal = async () => {
    const response = await manageSubscriptionAction({ environmentId });
    if (response?.data && typeof response.data === "string") {
      router.push(response.data);
    }
  };

  const openTrialPaymentCheckout = async () => {
    try {
      persistEnvironmentId();
      const response = await createTrialPaymentCheckoutAction({ environmentId });
      if (response?.data && typeof response.data === "string") {
        globalThis.location.href = response.data;
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

  const handlePlanAction = async (plan: "hobby" | "pro" | "scale", interval: TCloudBillingInterval) => {
    const actionKey = `${plan}-${interval}`;
    setIsPlanActionPending(actionKey);

    try {
      if (!hasPaymentMethod && plan !== "hobby") {
        persistEnvironmentId();
        const response = await createPlanCheckoutAction({
          environmentId,
          targetPlan: plan === "scale" ? "scale" : "pro",
          targetInterval: interval,
        });

        if (response?.data && typeof response.data === "string") {
          globalThis.location.href = response.data;
          return;
        }

        toast.error(t("common.something_went_wrong_please_try_again"));
        return;
      }

      const response = await changeBillingPlanAction({
        environmentId,
        targetPlan: plan,
        targetInterval: plan === "hobby" ? "monthly" : interval,
      });

      if (response?.data?.mode === "immediate") {
        toast.success(t("environments.settings.billing.plan_change_applied"));
      } else if (response?.data?.mode === "scheduled") {
        toast.success(t("environments.settings.billing.plan_change_scheduled"));
      } else {
        toast.success(t("environments.settings.billing.plan_change_applied"));
      }

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

  const getCtaLabel = (plan: "hobby" | "pro" | "scale", interval: TCloudBillingInterval) => {
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
      return t("environments.settings.billing.continue_to_checkout");
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
          <Alert>
            <AlertTitle>{t("environments.settings.billing.pending_plan_change_title")}</AlertTitle>
            <AlertDescription>
              {t("environments.settings.billing.pending_plan_change_description", {
                plan: getCurrentCloudPlanLabel(pendingChange.targetPlan, t),
                date: formatDate(new Date(pendingChange.effectiveAt), locale),
              })}
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
            canManageBillingDetails
              ? {
                  text: t("environments.settings.billing.manage_billing_details"),
                  onClick: () => void openBillingPortal(),
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
              <div className="flex w-fit rounded-xl border border-slate-200 bg-slate-100 p-1">
                {(["monthly", "yearly"] as const).map((interval) => (
                  <button
                    key={interval}
                    type="button"
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
                  const isDisabled =
                    !hasBillingRights ||
                    isCurrentSelection ||
                    isPendingSelection ||
                    isStripeSetupIncomplete ||
                    (isTrialing && !hasPaymentMethod);

                  return (
                    <div
                      key={`${planCard.plan}-${planCard.interval}`}
                      className={cn(
                        "flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm",
                        planCard.plan === "pro" ? "border-slate-900/20" : "border-slate-200"
                      )}>
                      <div className="mb-4 flex items-center gap-2">
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

                      <h3 className="text-3xl font-semibold text-slate-900">
                        {getCurrentCloudPlanLabel(planCard.plan, t)}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-500">{planCard.description}</p>

                      <div className="mt-8 flex items-end gap-2">
                        <span className="text-5xl font-semibold tracking-tight text-slate-900">
                          {planCard.amount}
                        </span>
                        <span className="pb-1 text-sm text-slate-500">
                          {planCard.plan === "hobby"
                            ? t("environments.settings.billing.per_month")
                            : planCard.interval === "monthly"
                              ? t("environments.settings.billing.per_month")
                              : t("environments.settings.billing.per_year")}
                        </span>
                      </div>

                      <Button
                        className="mt-8"
                        disabled={isDisabled}
                        loading={isPlanActionPending === `${planCard.plan}-${planCard.interval}`}
                        onClick={() => void handlePlanAction(planCard.plan, planCard.interval)}>
                        {getCtaLabel(planCard.plan, planCard.interval)}
                      </Button>

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
