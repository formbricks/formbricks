"use client";

import {
  isSubscriptionCancelledAction,
  manageSubscriptionAction,
  upgradePlanAction,
} from "@/app/(app)/environments/[environmentId]/settings/(organization)/billing/actions";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CLOUD_PRICING_DATA } from "@formbricks/ee/billing/lib/constants";
import { cn } from "@formbricks/lib/cn";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";
import { TOrganization, TOrganizationBillingPeriod } from "@formbricks/types/organizations";
import { Badge } from "@formbricks/ui/Badge";
import { BillingSlider } from "@formbricks/ui/BillingSlider";
import { Button } from "@formbricks/ui/Button";
import { PricingCard } from "@formbricks/ui/PricingCard";

interface PricingTableProps {
  organization: TOrganization;
  environmentId: string;
  peopleCount: number;
  responseCount: number;
  stripePriceLookupKeys: {
    STARTUP_MONTHLY: string;
    STARTUP_YEARLY: string;
    SCALE_MONTHLY: string;
    SCALE_YEARLY: string;
  };
  productFeatureKeys: {
    FREE: string;
    STARTUP: string;
    SCALE: string;
    ENTERPRISE: string;
  };
}

export const PricingTable = ({
  environmentId,
  organization,
  peopleCount,
  productFeatureKeys,
  responseCount,
  stripePriceLookupKeys,
}: PricingTableProps) => {
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
      organizationId: organization.id,
      environmentId,
    });
    if (manageSubscriptionResponse?.data) {
      router.push(manageSubscriptionResponse.data);
    }
  };

  const upgradePlan = async (priceLookupKey) => {
    try {
      const upgradePlanResponse = await upgradePlanAction({
        organizationId: organization.id,
        environmentId,
        priceLookupKey,
      });

      if (!upgradePlanResponse?.data) {
        throw new Error("Something went wrong");
      }

      const { status, newPlan, url } = upgradePlanResponse.data;

      if (status != 200) {
        throw new Error("Something went wrong");
      }
      if (!newPlan) {
        toast.success("Plan upgraded successfully");
      } else if (newPlan && url) {
        router.push(url);
      } else {
        throw new Error("Something went wrong");
      }
    } catch (err) {
      console.log({ err });
      toast.error("Unable to upgrade plan");
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
      toast.error("Everybody has the free plan by default!");
      return;
    }
  };

  const responsesUnlimitedCheck =
    organization.billing.plan === "enterprise" && organization.billing.limits.monthly.responses === null;
  const peopleUnlimitedCheck =
    organization.billing.plan === "enterprise" && organization.billing.limits.monthly.miu === null;

  return (
    <main>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col">
          <div className="flex w-full">
            <h2 className="mb-3 mr-2 inline-flex w-full text-2xl font-bold text-slate-700">
              Current Plan: {capitalizeFirstLetter(organization.billing.plan)}
              {cancellingOn && (
                <Badge
                  className="mx-2"
                  text={`Cancelling: ${cancellingOn ? cancellingOn.toDateString() : ""}`}
                  size="normal"
                  type="warning"
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
                  Manage Card Details
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
              <p className="text-md font-semibold text-slate-700">Responses</p>
              {organization.billing.limits.monthly.responses && (
                <BillingSlider
                  className="slider-class mb-8"
                  value={responseCount}
                  max={organization.billing.limits.monthly.responses * 1.5}
                  freeTierLimit={organization.billing.limits.monthly.responses}
                  metric={"Responses"}
                />
              )}

              {responsesUnlimitedCheck && <Badge text="Unlimited Responses" type="success" size="normal" />}
            </div>

            <div
              className={cn(
                "relative mx-8 flex flex-col gap-4 pb-12",
                peopleUnlimitedCheck && "mb-0 mt-4 flex-row pb-0"
              )}>
              <p className="text-md font-semibold text-slate-700">Monthly Identified Users</p>
              {organization.billing.limits.monthly.miu && (
                <BillingSlider
                  className="slider-class"
                  value={peopleCount}
                  max={organization.billing.limits.monthly.miu * 1.5}
                  freeTierLimit={organization.billing.limits.monthly.miu}
                  metric={"MIU"}
                />
              )}

              {peopleUnlimitedCheck && <Badge text="Unlimited MIU" type="success" size="normal" />}
            </div>
          </div>
        </div>

        <div className="mx-auto mb-12">
          <div className="flex gap-x-2">
            <div className="mb-4 flex w-fit max-w-xs cursor-pointer overflow-hidden rounded-lg border border-slate-200 p-1 lg:mb-0">
              <div
                className={`flex-1 rounded-md px-4 py-0.5 text-center ${
                  planPeriod === "monthly" ? "bg-slate-200 font-semibold" : "bg-transparent"
                }`}
                onClick={() => handleMonthlyToggle("monthly")}>
                Monthly
              </div>
              <div
                className={`flex-1 rounded-md px-4 py-0.5 text-center ${
                  planPeriod === "yearly" ? "bg-slate-200 font-semibold" : "bg-transparent"
                }`}
                onClick={() => handleMonthlyToggle("yearly")}>
                Yearly
              </div>
            </div>
          </div>
          <div className="relative mx-auto grid max-w-md grid-cols-1 gap-y-8 lg:mx-0 lg:-mb-14 lg:max-w-none lg:grid-cols-4">
            <div
              className="hidden lg:absolute lg:inset-x-px lg:bottom-0 lg:top-4 lg:block lg:rounded-xl lg:rounded-t-2xl lg:border lg:border-slate-200 lg:bg-slate-100 lg:pb-8 lg:ring-1 lg:ring-white/10"
              aria-hidden="true"
            />
            {CLOUD_PRICING_DATA.plans.map((plan) => (
              <PricingCard
                planPeriod={planPeriod}
                key={plan.id}
                plan={plan}
                onUpgrade={async () => {
                  await onUpgrade(plan.id);
                }}
                organization={organization}
                productFeatureKeys={productFeatureKeys}
                onManageSubscription={openCustomerPortal}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};
