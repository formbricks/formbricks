"use client";

import {
  isSubscriptionCancelledAction,
  manageSubscriptionAction,
  upgradePlanAction,
} from "@/app/(app)/environments/[environmentId]/settings/(organization)/billing/actions";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { STRIPE_PRICE_LOOKUP_KEYS } from "@formbricks/ee/billing/lib/constants";
import { cn } from "@formbricks/lib/cn";
import { TOrganization } from "@formbricks/types/organizations";
import { Badge } from "@formbricks/ui/Badge";
import { BillingSlider } from "@formbricks/ui/BillingSlider";
import { Button } from "@formbricks/ui/Button";
import { LoadingSpinner } from "@formbricks/ui/LoadingSpinner";
import { PricingCard } from "@formbricks/ui/PricingCard";

interface PricingTableProps {
  organization: TOrganization;
  environmentId: string;
  peopleCount: number;
  responseCount: number;
}

export const PricingTable = ({
  organization,
  environmentId,
  peopleCount,
  responseCount,
}: PricingTableProps) => {
  const router = useRouter();
  const [loadingCustomerPortal, setLoadingCustomerPortal] = useState(false);
  const [cancellingOn, setCancellingOn] = useState<Date | null>(null);

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      const isCancelled = await isSubscriptionCancelledAction(organization.id);
      if (isCancelled) {
        setCancellingOn(isCancelled.date);
      }
    };
    checkSubscriptionStatus();
  }, [organization.id]);

  const openCustomerPortal = async () => {
    setLoadingCustomerPortal(true);
    const sessionUrl = await manageSubscriptionAction(organization.id, environmentId);
    router.push(sessionUrl);
    setLoadingCustomerPortal(false);
  };

  const upgradePlan = async (priceLookupKey: STRIPE_PRICE_LOOKUP_KEYS) => {
    try {
      const { status, newPlan, url } = await upgradePlanAction(
        organization.id,
        environmentId,
        priceLookupKey
      );

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

  const freeFeatures = [
    "Unlimited Surveys",
    "Unlimited Organization Members",
    "Unlimited Connected Domains / Apps / Websites",
    "500 Responses / Month",
    "1,000 Identified Users / Month",
    "Logic Jumps, Hidden Fields, Recurring Surveys, etc.",
    "Website Popup Surveys",
    "In-product Surveys for Web with Attribute Targeting",
    "Link Surveys (Shareable Page)",
    "Email Embedded Surveys",
    "All Integrations",
    "API & Webhooks",
  ];

  const startupFeatures = [
    "Everything in Free",
    "2,000 Responses / Month",
    "2,500 Identified Users / Month",
    "Bigger File Uploads in Surveys",
    "Remove Formbricks Branding",
  ];

  const scaleFeatures = [
    "Everything in Startup",
    "5,000 Responses / Month",
    "20,000 Identified Users / Month",
    "Email Support",
    "Multi-Language Surveys",
    "Advanced Targeting based on User Actions",
    "Organization Access Control",
  ];

  const enterpriseFeatures = [
    "Everything in Scale",
    "Custom Response Limits",
    "Custom User Identification Limits",
    "Priority Support with SLA",
    "99% Uptime SLA",
    "Customer Success Manager",
    "Technical Onboarding",
  ];

  const responsesUnlimitedCheck =
    organization.billing.plan === "enterprise" && organization.billing.limits.monthly.responses === null;
  const peopleUnlimitedCheck =
    organization.billing.plan === "enterprise" && organization.billing.limits.monthly.miu === null;

  return (
    <div className="relative">
      {loadingCustomerPortal && (
        <div className="absolute h-full w-full rounded-lg bg-slate-900/5">
          <LoadingSpinner />
        </div>
      )}
      <div className="justify-between gap-4 rounded-lg capitalize">
        <div className="flex w-full">
          <h2 className="mr-2 inline-flex w-full text-2xl font-bold text-slate-700">
            Current Plan: {organization.billing.plan}
            {cancellingOn && (
              <Badge
                className="mx-2"
                text={`Cancelling: ${cancellingOn ? cancellingOn.toDateString() : ""}`}
                size="normal"
                type="warning"
              />
            )}
          </h2>

          {organization.billing.stripeCustomerId && (
            <div className="flex w-full justify-end">
              <Button
                size="sm"
                variant="secondary"
                className="justify-center py-2 shadow-sm"
                loading={loadingCustomerPortal}
                onClick={openCustomerPortal}>
                {organization.billing.plan !== "free" ? "Manage Subscription" : "Manage Card details"}
              </Button>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-col rounded-lg border border-slate-300 bg-slate-100 py-4 capitalize shadow-sm dark:bg-slate-800">
          <div
            className={cn(
              "relative mx-8 mb-8 flex flex-col gap-4",
              responsesUnlimitedCheck && "mb-0 flex-row"
            )}>
            <p className="text-md font-semibold text-slate-700">Responses</p>
            {organization.billing.limits.monthly.responses && (
              <BillingSlider
                className="slider-class"
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
        <div className="flex w-full justify-center gap-x-4">
          <PricingCard
            title={"Formbricks Startup"}
            subtitle={"Ideal for small organizations"}
            plan="startup"
            monthlyPrice={49}
            actionText={"Starting at"}
            organization={organization}
            paidFeatures={startupFeatures}
            onUpgrade={() => upgradePlan(STRIPE_PRICE_LOOKUP_KEYS.STARTUP_MONTHLY)}
          />
          <PricingCard
            title={"Formbricks Scale"}
            subtitle={"Ideal for growing organizations"}
            plan="scale"
            monthlyPrice={199}
            actionText={"Starting at"}
            organization={organization}
            paidFeatures={scaleFeatures}
            onUpgrade={async () => {
              await upgradePlan(STRIPE_PRICE_LOOKUP_KEYS.SCALE_MONTHLY);
            }}
          />
          <PricingCard
            title={"Formbricks Enterprise"}
            subtitle={"Ideal for large organizations"}
            plan="enterprise"
            organization={organization}
            paidFeatures={enterpriseFeatures}
            onUpgrade={() => (window.location.href = "mailto:hola@formbricks.com")}
          />
        </div>
        <PricingCard
          title={"Formbricks Free"}
          subtitle={"Available to Everybody"}
          plan="free"
          organization={organization}
          paidFeatures={freeFeatures}
          onUpgrade={() => toast.error("Everybody has the free plan by default!")}
        />
      </div>
    </div>
  );
};
