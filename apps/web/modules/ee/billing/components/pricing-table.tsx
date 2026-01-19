"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganization, TOrganizationBillingPeriod } from "@formbricks/types/organizations";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { isSubscriptionCancelledAction, manageSubscriptionAction, upgradePlanAction } from "../actions";
import { getCloudPricingData } from "../api/lib/constants";
import { OverageCard } from "./overage-card";
import { PricingCard } from "./pricing-card";
import { SettingsId } from "./settings-id";

type DemoPlanState = "trial" | "hobby" | "pro" | "scale";

function getPlanDisplayName(plan: string) {
  switch (plan) {
    case "free":
      return "Hobby";
    case "pro":
      return "Pro";
    case "scale":
      return "Scale";
    default:
      return plan.charAt(0).toUpperCase() + plan.slice(1);
  }
}

const DEMO_PLAN_CONFIGS: Record<
  DemoPlanState,
  {
    plan: string;
    displayName: string;
    limits: { responses: number; miu: number; projects: number };
    hasStripeCustomer: boolean;
    trialEndsAt: Date | null;
    billingPeriod: TOrganizationBillingPeriod;
  }
> = {
  trial: {
    plan: "scale",
    displayName: "Scale (Trial)",
    limits: { responses: 5000, miu: 10000, projects: 5 },
    hasStripeCustomer: false,
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    billingPeriod: "monthly",
  },
  hobby: {
    plan: "free",
    displayName: "Hobby",
    limits: { responses: 500, miu: 1250, projects: 1 },
    hasStripeCustomer: false,
    trialEndsAt: null,
    billingPeriod: "monthly",
  },
  pro: {
    plan: "pro",
    displayName: "Pro",
    limits: { responses: 1000, miu: 2500, projects: 3 },
    hasStripeCustomer: true,
    trialEndsAt: null,
    billingPeriod: "monthly",
  },
  scale: {
    plan: "scale",
    displayName: "Scale",
    limits: { responses: 5000, miu: 10000, projects: 5 },
    hasStripeCustomer: true,
    trialEndsAt: null,
    billingPeriod: "monthly",
  },
};

interface PricingTableProps {
  organization: TOrganization;
  environmentId: string;
  peopleCount: number;
  responseCount: number;
  projectCount: number;
  stripePriceLookupKeys: {
    STARTUP_MAY25_MONTHLY: string;
    STARTUP_MAY25_YEARLY: string;
  };
  hasBillingRights: boolean;
}

export const PricingTable = ({
  environmentId,
  organization,
  peopleCount,
  responseCount,
  projectCount,
  stripePriceLookupKeys,
  hasBillingRights,
}: PricingTableProps) => {
  const { t } = useTranslation();
  const [planPeriod, setPlanPeriod] = useState<TOrganizationBillingPeriod>(
    organization.billing.period ?? "monthly"
  );

  // Demo mode state
  const [demoPlan, setDemoPlan] = useState<DemoPlanState | null>(null);
  const [demoOverageMode, setDemoOverageMode] = useState<"allow" | "blocked">("allow");
  const [demoSpendingLimit, setDemoSpendingLimit] = useState<number | null>(null);

  // Demo overage usage (simulated values for demo)
  const demoOverageUsage = {
    responses: 150,
    responseCost: 12, // $0.08/response for Pro
    contacts: 320,
    contactsCost: 12.8, // $0.04/contact for Pro
  };

  const router = useRouter();
  const [cancellingOn, setCancellingOn] = useState<Date | null>(null);

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      const isSubscriptionCancelledResponse = await isSubscriptionCancelledAction({
        organizationId: organization.id,
      });
      if (isSubscriptionCancelledResponse?.data) {
        setCancellingOn(isSubscriptionCancelledResponse.data.date);
      }
    };
    checkSubscriptionStatus();
  }, [organization.id]);

  // Get effective values based on demo mode
  const demoConfig = demoPlan ? DEMO_PLAN_CONFIGS[demoPlan] : null;
  const effectivePlan = demoConfig?.plan ?? organization.billing.plan;
  const effectiveDisplayName = demoConfig?.displayName ?? getPlanDisplayName(organization.billing.plan);
  const effectiveResponsesLimit =
    demoConfig?.limits.responses ?? organization.billing.limits.monthly.responses;
  const effectiveMiuLimit = demoConfig?.limits.miu ?? organization.billing.limits.monthly.miu;
  const effectiveProjectsLimit = demoConfig?.limits.projects ?? organization.billing.limits.projects;
  const effectiveHasStripeCustomer = demoConfig?.hasStripeCustomer ?? !!organization.billing.stripeCustomerId;
  const effectiveTrialEndsAt = demoConfig?.trialEndsAt ?? null;
  const effectiveBillingPeriod = demoConfig?.billingPeriod ?? organization.billing.period ?? "monthly";

  // Determine if user is on a paid plan
  const isOnPaidPlan = effectivePlan === "pro" || effectivePlan === "scale";
  const isOnMonthlyBilling = effectiveBillingPeriod === "monthly" && isOnPaidPlan;

  // Create a mock organization for the pricing cards when in demo mode
  const effectiveOrganization: TOrganization = demoPlan
    ? {
        ...organization,
        billing: {
          ...organization.billing,
          plan: effectivePlan,
          period: effectiveBillingPeriod,
          stripeCustomerId: effectiveHasStripeCustomer ? "demo_stripe_id" : null,
          limits: {
            ...organization.billing.limits,
            monthly: {
              responses: effectiveResponsesLimit,
              miu: effectiveMiuLimit,
            },
            projects: effectiveProjectsLimit,
          },
        },
      }
    : organization;

  const openCustomerPortal = async () => {
    if (demoPlan) {
      toast.success("Demo: Would open Stripe Customer Portal");
      return;
    }
    const manageSubscriptionResponse = await manageSubscriptionAction({
      environmentId,
    });
    if (manageSubscriptionResponse?.data && typeof manageSubscriptionResponse.data === "string") {
      router.push(manageSubscriptionResponse.data);
    }
  };

  const upgradePlan = async (priceLookupKey: string) => {
    if (demoPlan) {
      toast.success(`Demo: Would upgrade to ${priceLookupKey}`);
      return;
    }
    try {
      const upgradePlanResponse = await upgradePlanAction({
        environmentId,
        priceLookupKey,
      });

      if (!upgradePlanResponse?.data) {
        throw new Error(t("common.something_went_wrong_please_try_again"));
      }

      const { status, newPlan, url } = upgradePlanResponse.data;

      if (status != 200) {
        throw new Error(t("common.something_went_wrong_please_try_again"));
      }
      if (!newPlan) {
        toast.success(t("environments.settings.billing.plan_upgraded_successfully"));
      } else if (newPlan && url) {
        router.push(url);
      } else {
        throw new Error(t("common.something_went_wrong_please_try_again"));
      }
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error(t("environments.settings.billing.unable_to_upgrade_plan"));
      }
    }
  };

  const onUpgrade = async (planId: string) => {
    // Map new plan IDs to existing Stripe keys
    if (planId === "pro") {
      await upgradePlan(
        planPeriod === "monthly"
          ? stripePriceLookupKeys.STARTUP_MAY25_MONTHLY
          : stripePriceLookupKeys.STARTUP_MAY25_YEARLY
      );
      return;
    }

    if (planId === "scale") {
      if (demoPlan) {
        toast.success("Demo: Would redirect to Scale plan signup");
        return;
      }
      // Scale plan redirects to custom plan page for now
      globalThis.location.href = "https://formbricks.com/custom-plan?source=billingView";
      return;
    }

    if (planId === "free") {
      toast.error(t("environments.settings.billing.everybody_has_the_free_plan_by_default"));
    }
  };

  const handleUpgradeToAnnual = async () => {
    if (demoPlan) {
      toast.success("Demo: Would upgrade to annual billing");
      return;
    }
    await openCustomerPortal();
  };

  return (
    <div className="space-y-6">
      {/* Demo Mode Toggle */}
      <div className="max-w-4xl rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-amber-700 uppercase">Demo Mode</span>
          <span className="text-xs text-amber-600">— Preview different plan states</span>
        </div>
        <div className="flex gap-2">
          {(["trial", "hobby", "pro", "scale"] as DemoPlanState[]).map((plan) => (
            <button
              key={plan}
              onClick={() => setDemoPlan(demoPlan === plan ? null : plan)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                demoPlan === plan ? "bg-amber-500 text-white" : "bg-white text-slate-700 hover:bg-amber-100"
              )}>
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </button>
          ))}
          {demoPlan && (
            <button
              onClick={() => setDemoPlan(null)}
              className="ml-2 text-sm text-amber-600 underline hover:text-amber-800">
              Reset to actual
            </button>
          )}
        </div>
      </div>

      {/* Your Plan Status */}
      <SettingsCard
        title="Your Plan"
        description="Manage your subscription and usage."
        className="my-0"
        buttonInfo={
          effectiveHasStripeCustomer
            ? {
                text: "Manage billing",
                onClick: () => {
                  void openCustomerPortal();
                },
                variant: "secondary",
              }
            : undefined
        }>
        <div className="mb-6 flex items-center gap-4">
          <SettingsId label="Current Plan" value={effectiveDisplayName} />
          {effectiveTrialEndsAt && (
            <Badge
              type="gray"
              size="normal"
              text={`Trial ends ${effectiveTrialEndsAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}`}
            />
          )}
          {cancellingOn && !demoPlan && (
            <Badge
              type="warning"
              size="normal"
              text={`Cancels ${cancellingOn.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}`}
            />
          )}
        </div>

        {/* Usage Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Responses this month</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {responseCount.toLocaleString()}
              {effectiveResponsesLimit && (
                <span className="text-sm font-normal text-slate-400">
                  {" "}
                  / {effectiveResponsesLimit.toLocaleString()}
                </span>
              )}
            </p>
            {effectiveResponsesLimit && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn(
                    "h-full rounded-full",
                    responseCount / effectiveResponsesLimit > 0.9 ? "bg-red-500" : "bg-teal-500"
                  )}
                  style={{ width: `${Math.min((responseCount / effectiveResponsesLimit) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Identified Contacts</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {peopleCount.toLocaleString()}
              {effectiveMiuLimit && (
                <span className="text-sm font-normal text-slate-400">
                  {" "}
                  / {effectiveMiuLimit.toLocaleString()}
                </span>
              )}
            </p>
            {effectiveMiuLimit && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn(
                    "h-full rounded-full",
                    peopleCount / effectiveMiuLimit > 0.9 ? "bg-red-500" : "bg-teal-500"
                  )}
                  style={{ width: `${Math.min((peopleCount / effectiveMiuLimit) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Workspaces</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {projectCount}
              {effectiveProjectsLimit && (
                <span className="text-sm font-normal text-slate-400"> / {effectiveProjectsLimit}</span>
              )}
            </p>
            {effectiveProjectsLimit && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn(
                    "h-full rounded-full",
                    projectCount / effectiveProjectsLimit > 0.9 ? "bg-red-500" : "bg-teal-500"
                  )}
                  style={{ width: `${Math.min((projectCount / effectiveProjectsLimit) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-500">Your volumes renew on Feb 1, 2025</p>
      </SettingsCard>

      {/* Overage Card (only for paid plans or trial) */}
      {(isOnPaidPlan || effectiveTrialEndsAt) && (
        <SettingsCard
          title="Dynamic Overage Handling"
          description="Control how your surveys behave when you exceed your included usage limits."
          className="my-0">
          <OverageCard
            currentMode={demoOverageMode}
            spendingLimit={demoSpendingLimit}
            overageUsage={demoOverageUsage}
            onModeChange={async (mode) => {
              if (demoPlan) {
                toast.success(`Demo: Would change overage mode to ${mode}`);
                setDemoOverageMode(mode);
                return;
              }
              // TODO: Implement actual overage mode change via API
              toast.success(`Overage mode changed to ${mode}`);
              setDemoOverageMode(mode);
            }}
            onSpendingLimitChange={async (limit) => {
              if (demoPlan) {
                toast.success(
                  limit ? `Demo: Would set spending limit to $${limit}` : "Demo: Would remove spending limit"
                );
                setDemoSpendingLimit(limit);
                return;
              }
              // TODO: Implement actual spending limit change via API
              toast.success(limit ? `Spending limit set to $${limit}` : "Spending limit removed");
              setDemoSpendingLimit(limit);
            }}
          />
        </SettingsCard>
      )}

      {/* Alert: Annual Billing Upgrade (only for monthly paid plans) */}
      {isOnMonthlyBilling && (
        <Alert variant="info" className="max-w-4xl">
          <AlertTitle>Save 20% on Annual Billing</AlertTitle>
          <AlertDescription>Simplify your billing cycle and get 2 months free.</AlertDescription>
          <AlertButton onClick={handleUpgradeToAnnual}>Switch to Annual</AlertButton>
        </Alert>
      )}

      {/* Alert: Special Pricing Programs (only for non-paid plans) */}
      {!isOnPaidPlan && (
        <Alert variant="info" className="max-w-4xl">
          <AlertTitle>Special Pricing Programs</AlertTitle>
          <AlertDescription>
            Exclusive discounts for Startups, Non-profits, and Open Source projects.
          </AlertDescription>
          <AlertButton
            onClick={() => {
              if (demoPlan) {
                toast.success("Demo: Would open discount application form");
                return;
              }
              globalThis.open("https://formbricks.com/discount", "_blank");
            }}>
            Apply for Discount
          </AlertButton>
        </Alert>
      )}

      {/* Pricing Plans */}
      {hasBillingRights && (
        <div className="max-w-5xl">
          {/* Period Toggle */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex overflow-hidden rounded-lg border border-slate-200 p-1">
              <button
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  planPeriod === "monthly" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                )}
                onClick={() => setPlanPeriod("monthly")}>
                Monthly
              </button>
              <button
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  planPeriod === "yearly" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                )}
                onClick={() => setPlanPeriod("yearly")}>
                Annually
              </button>
            </div>
            {planPeriod === "yearly" && (
              <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                Get 2 months free 🔥
              </span>
            )}
          </div>

          {/* Plan Cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {getCloudPricingData(t).plans.map((plan) => (
              <PricingCard
                planPeriod={planPeriod}
                key={plan.id}
                plan={plan}
                onUpgrade={async () => {
                  await onUpgrade(plan.id);
                }}
                organization={effectiveOrganization}
                onManageSubscription={openCustomerPortal}
                isTrialActive={demoPlan === "trial" && plan.id === "scale"}
                currentPlan={effectivePlan}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
