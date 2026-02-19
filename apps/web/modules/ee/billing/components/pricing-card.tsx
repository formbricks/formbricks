"use client";

import { CheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TOrganizationBillingPeriod } from "@formbricks/types/organizations";
import { cn } from "@/lib/cn";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { TPricingPlan } from "../api/lib/constants";

interface PricingCardProps {
  plan: TPricingPlan;
  planPeriod: TOrganizationBillingPeriod;
  currentPlan: "hobby" | "pro" | "scale" | "trial" | "unknown";
  onUpgrade: () => Promise<void>;
  onManageSubscription: () => Promise<void>;
}

export const PricingCard = ({
  planPeriod,
  plan,
  onUpgrade,
  onManageSubscription,
  currentPlan,
}: PricingCardProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const displayPrice = planPeriod === "monthly" ? plan.price.monthly : plan.price.yearly;

  const isCurrentPlan = useMemo(() => {
    if (currentPlan === "trial") {
      return plan.id === "pro";
    }

    return currentPlan === plan.id;
  }, [currentPlan, plan.id]);

  const CTAButton = useMemo(() => {
    if (isCurrentPlan) {
      return null;
    }

    return (
      <Button
        loading={loading}
        variant={plan.featured ? "default" : "secondary"}
        onClick={async () => {
          setLoading(true);
          await onUpgrade();
          setLoading(false);
        }}
        className="flex justify-center">
        {plan.CTA ?? t("environments.settings.billing.upgrade")}
      </Button>
    );
  }, [isCurrentPlan, loading, onUpgrade, plan.CTA, plan.featured, t]);

  return (
    <div
      key={plan.id}
      className={cn(
        plan.featured
          ? "z-10 bg-white shadow-lg ring-1 ring-slate-900/10"
          : "bg-slate-100 ring-1 ring-white/10 lg:bg-transparent lg:pb-8 lg:ring-0",
        "relative rounded-xl"
      )}>
      <div className="p-8 lg:pt-12 xl:p-10 xl:pt-14">
        <div className="flex gap-x-2">
          <h2
            id={plan.id}
            className={cn(
              plan.featured ? "text-slate-900" : "text-slate-800",
              "text-sm font-semibold leading-6"
            )}>
            {plan.name}
          </h2>
          {isCurrentPlan && (
            <Badge type="success" size="normal" text={t("environments.settings.billing.current_plan")} />
          )}
        </div>
        <div className="flex flex-col items-end gap-6 sm:flex-row sm:justify-between lg:flex-col lg:items-stretch">
          <div className="mt-2 flex items-end gap-x-1">
            <p
              className={cn(
                plan.featured ? "text-slate-900" : "text-slate-800",
                "text-4xl font-bold tracking-tight"
              )}>
              {displayPrice}
            </p>
            <div className="text-sm leading-5">
              <p className={plan.featured ? "text-slate-700" : "text-slate-600"}>
                / {planPeriod === "monthly" ? "Month" : "Year"}
              </p>
            </div>
          </div>

          {CTAButton}

          {plan.id !== "hobby" && isCurrentPlan && (
            <Button
              loading={loading}
              onClick={async () => {
                setLoading(true);
                await onManageSubscription();
                setLoading(false);
              }}
              className="flex justify-center bg-[#635bff]">
              {t("environments.settings.billing.manage_subscription")}
            </Button>
          )}
        </div>
        <div className="mt-8 flow-root sm:mt-10">
          <ul
            className={cn(
              plan.featured
                ? "divide-slate-900/5 border-slate-900/5 text-slate-600"
                : "divide-white/5 border-white/5 text-slate-800",
              "-my-2 divide-y border-t text-sm leading-6 lg:border-t-0"
            )}>
            {plan.mainFeatures.map((mainFeature) => (
              <li key={mainFeature} className="flex gap-x-3 py-2">
                <CheckIcon
                  className={cn(plan.featured ? "text-brand-dark" : "text-slate-500", "h-6 w-5 flex-none")}
                  aria-hidden="true"
                />
                {mainFeature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
