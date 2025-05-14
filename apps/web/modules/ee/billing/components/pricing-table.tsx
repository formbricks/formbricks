"use client";

import { cn } from "@/lib/cn";
import { capitalizeFirstLetter } from "@/lib/utils/strings";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TOrganization, TOrganizationBillingPeriod } from "@formbricks/types/organizations";
import { isSubscriptionCancelledAction, manageSubscriptionAction, upgradePlanAction } from "../actions";
import { getCloudPricingData } from "../api/lib/constants";
import { BillingSlider } from "./billing-slider";
import { PricingCard } from "./pricing-card";

interface PricingTableProps {
  organization: TOrganization;
  environmentId: string;
  peopleCount: number;
  responseCount: number;
  projectCount: number;
  stripePriceLookupKeys: {
    STARTUP_MONTHLY: string;
    STARTUP_YEARLY: string;
    SCALE_MONTHLY: string;
    SCALE_YEARLY: string;
  };
  projectFeatureKeys: {
    FREE: string;
    STARTUP: string;
    SCALE: string;
    ENTERPRISE: string;
  };
  hasBillingRights: boolean;
}

export const PricingTable = ({
  environmentId,
  organization,
  peopleCount,
  projectFeatureKeys,
  responseCount,
  projectCount,
  stripePriceLookupKeys,
  hasBillingRights,
}: PricingTableProps) => {
  const { t } = useTranslate();
  const [planPeriod, setPlanPeriod] = useState<TOrganizationBillingPeriod>(
    organization.billing.period ?? "monthly"
  );

  const handleMonthlyToggle = (period: TOrganizationBillingPeriod) => {
    setPlanPeriod(period);
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

  const openCustomerPortal = async () => {
    const manageSubscriptionResponse = await manageSubscriptionAction({
      environmentId,
    });
    if (manageSubscriptionResponse?.data && typeof manageSubscriptionResponse.data === "string") {
      router.push(manageSubscriptionResponse.data);
    }
  };

  const upgradePlan = async (priceLookupKey) => {
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
      toast.error(t("environments.settings.billing.unable_to_upgrade_plan"));
    }
  };

  const onUpgrade = async (planId: string) => {
    if (planId === "scale") {
      await upgradePlan(
        planPeriod === "monthly" ? stripePriceLookupKeys.SCALE_MONTHLY : stripePriceLookupKeys.SCALE_YEARLY
      );
      return;
    }

    if (planId === "startup") {
      await upgradePlan(
        planPeriod === "monthly"
          ? stripePriceLookupKeys.STARTUP_MONTHLY
          : stripePriceLookupKeys.STARTUP_YEARLY
      );
      return;
    }

    if (planId === "enterprise") {
      window.location.href = "https://cal.com/johannes/license";
      return;
    }

    if (planId === "free") {
      toast.error(t("environments.settings.billing.everybody_has_the_free_plan_by_default"));
      return;
    }
  };

  const responsesUnlimitedCheck =
    organization.billing.plan === "enterprise" && organization.billing.limits.monthly.responses === null;
  const peopleUnlimitedCheck =
    organization.billing.plan === "enterprise" && organization.billing.limits.monthly.miu === null;
  const projectsUnlimitedCheck =
    organization.billing.plan === "enterprise" && organization.billing.limits.projects === null;

  return (
    <main>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col">
          <div className="flex w-full">
            <h2 className="mb-3 mr-2 inline-flex w-full text-2xl font-bold text-slate-700">
              {t("environments.settings.billing.current_plan")}:{" "}
              {capitalizeFirstLetter(organization.billing.plan)}
              {cancellingOn && (
                <Badge
                  className="mx-2"
                  size="normal"
                  type="warning"
                  text={`Cancelling: ${cancellingOn ? cancellingOn.toDateString() : ""}`}
                />
              )}
            </h2>

            {organization.billing.stripeCustomerId && organization.billing.plan === "free" && (
              <div className="flex w-full justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  className="justify-center py-2 shadow-sm"
                  onClick={openCustomerPortal}>
                  {t("environments.settings.billing.manage_card_details")}
                </Button>
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-col rounded-xl border border-slate-200 bg-white py-4 capitalize shadow-sm dark:bg-slate-800">
            <div
              className={cn(
                "relative mx-8 mb-8 flex flex-col gap-4",
                responsesUnlimitedCheck && "mb-0 flex-row"
              )}>
              <p className="text-md font-semibold text-slate-700">{t("common.responses")}</p>
              {organization.billing.limits.monthly.responses && (
                <BillingSlider
                  className="slider-class mb-8"
                  value={responseCount}
                  max={organization.billing.limits.monthly.responses * 1.5}
                  freeTierLimit={organization.billing.limits.monthly.responses}
                  metric={t("common.responses")}
                />
              )}

              {responsesUnlimitedCheck && (
                <Badge
                  type="success"
                  size="normal"
                  text={t("environments.settings.billing.unlimited_responses")}
                />
              )}
            </div>

            <div
              className={cn(
                "relative mx-8 mb-8 flex flex-col gap-4",
                peopleUnlimitedCheck && "mb-0 mt-4 flex-row pb-0"
              )}>
              <p className="text-md font-semibold text-slate-700">
                {t("environments.settings.billing.monthly_identified_users")}
              </p>
              {organization.billing.limits.monthly.miu && (
                <BillingSlider
                  className="slider-class mb-8"
                  value={peopleCount}
                  max={organization.billing.limits.monthly.miu * 1.5}
                  freeTierLimit={organization.billing.limits.monthly.miu}
                  metric={"MIU"}
                />
              )}

              {peopleUnlimitedCheck && (
                <Badge type="success" size="normal" text={t("environments.settings.billing.unlimited_miu")} />
              )}
            </div>

            <div
              className={cn(
                "relative mx-8 flex flex-col gap-4 pb-12",
                projectsUnlimitedCheck && "mb-0 mt-4 flex-row pb-0"
              )}>
              <p className="text-md font-semibold text-slate-700">{t("common.projects")}</p>
              {organization.billing.limits.projects && (
                <BillingSlider
                  className="slider-class mb-8"
                  value={projectCount}
                  max={organization.billing.limits.projects * 1.5}
                  freeTierLimit={organization.billing.limits.projects}
                  metric={t("common.projects")}
                />
              )}

              {projectsUnlimitedCheck && (
                <Badge
                  type="success"
                  size="normal"
                  text={t("environments.settings.billing.unlimited_projects")}
                />
              )}
            </div>
          </div>
        </div>

        {hasBillingRights && (
          <div className="mx-auto mb-12">
            <div className="gap-x-2">
              <div className="mb-4 flex w-fit cursor-pointer overflow-hidden rounded-lg border border-slate-200 p-1 lg:mb-0">
                <button
                  className={`flex-1 rounded-md px-4 py-0.5 text-center ${
                    planPeriod === "monthly" ? "bg-slate-200 font-semibold" : "bg-transparent"
                  }`}
                  onClick={() => handleMonthlyToggle("monthly")}>
                  {t("environments.settings.billing.monthly")}
                </button>
                <button
                  className={`flex-1 items-center whitespace-nowrap rounded-md py-0.5 pl-4 pr-2 text-center ${
                    planPeriod === "yearly" ? "bg-slate-200 font-semibold" : "bg-transparent"
                  }`}
                  onClick={() => handleMonthlyToggle("yearly")}>
                  {t("environments.settings.billing.annually")}
                  <span className="ml-2 inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    {t("environments.settings.billing.get_2_months_free")} 🔥
                  </span>
                </button>
              </div>
              <div className="relative mx-auto grid max-w-md grid-cols-1 gap-y-8 lg:mx-0 lg:-mb-14 lg:max-w-none lg:grid-cols-4">
                <div
                  className="hidden lg:absolute lg:inset-x-px lg:bottom-0 lg:top-4 lg:block lg:rounded-xl lg:rounded-t-2xl lg:border lg:border-slate-200 lg:bg-slate-100 lg:pb-8 lg:ring-1 lg:ring-white/10"
                  aria-hidden="true"
                />
                {getCloudPricingData(t).plans.map((plan) => (
                  <PricingCard
                    planPeriod={planPeriod}
                    key={plan.id}
                    plan={plan}
                    onUpgrade={async () => {
                      await onUpgrade(plan.id);
                    }}
                    organization={organization}
                    projectFeatureKeys={projectFeatureKeys}
                    onManageSubscription={openCustomerPortal}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
