"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { TOrganization, TOrganizationBillingPeriod } from "@formbricks/types/organizations";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { TPricingPlan } from "../api/lib/constants";

interface PricingCardProps {
  plan: TPricingPlan;
  planPeriod: TOrganizationBillingPeriod;
  organization: TOrganization;
  onUpgrade: () => Promise<void>;
  onManageSubscription: () => Promise<void>;
  isTrialActive?: boolean;
  currentPlan: string;
}

export const PricingCard = ({
  planPeriod,
  plan,
  onUpgrade,
  onManageSubscription,
  organization,
  isTrialActive = false,
  currentPlan,
}: PricingCardProps) => {
  const [loading, setLoading] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const displayPrice = planPeriod === "monthly" ? plan.price.monthly : plan.price.yearly;
  const isMonetaryPrice = displayPrice.startsWith("$");

  const isCurrentPlan = useMemo(() => {
    if (currentPlan === "free" && plan.id === "free") return true;
    if (currentPlan === "pro" && plan.id === "pro") return true;
    if (currentPlan === "scale" && plan.id === "scale") return true;
    return false;
  }, [currentPlan, plan.id]);

  const hasActiveSubscription =
    !!organization.billing.stripeCustomerId && isCurrentPlan && plan.id !== "free";

  // Check if this is the "other" paid plan (for Change plan button)
  const isOtherPaidPlan =
    (currentPlan === "pro" && plan.id === "scale") || (currentPlan === "scale" && plan.id === "pro");

  const CTAButton = useMemo(() => {
    // Trial state: show "Subscribe now" to convert
    if (isTrialActive && plan.id === "scale") {
      return (
        <Button
          loading={loading}
          variant="default"
          onClick={async () => {
            setLoading(true);
            await onUpgrade();
            setLoading(false);
          }}
          className="w-full justify-center">
          Subscribe now
        </Button>
      );
    }

    // Current paid plan with subscription
    if (hasActiveSubscription) {
      return (
        <Button
          loading={loading}
          variant="secondary"
          onClick={async () => {
            setLoading(true);
            await onManageSubscription();
            setLoading(false);
          }}
          className="w-full justify-center">
          Manage subscription
        </Button>
      );
    }

    // Current plan (free/hobby)
    if (isCurrentPlan && plan.id === "free") {
      return (
        <Button variant="secondary" disabled className="w-full justify-center">
          Get started
        </Button>
      );
    }

    // Free plan for non-free users - cannot downgrade
    if (plan.id === "free" && currentPlan !== "free") {
      return (
        <Button variant="secondary" disabled className="w-full justify-center">
          Get started
        </Button>
      );
    }

    // If user is on a paid plan and this is the other paid plan, show "Change plan"
    if (isOtherPaidPlan) {
      return (
        <Button
          loading={loading}
          variant="secondary"
          onClick={async () => {
            setLoading(true);
            await onUpgrade();
            setLoading(false);
          }}
          className="w-full justify-center">
          Change plan
        </Button>
      );
    }

    // User is on Hobby, show "Upgrade" for paid plans
    if (currentPlan === "free" && (plan.id === "pro" || plan.id === "scale")) {
      return (
        <Button
          loading={loading}
          variant={plan.featured ? "default" : "secondary"}
          onClick={async () => {
            setLoading(true);
            await onUpgrade();
            setLoading(false);
          }}
          className="w-full justify-center">
          Upgrade
        </Button>
      );
    }

    // Default fallback
    return (
      <Button
        loading={loading}
        variant={plan.featured ? "default" : "secondary"}
        onClick={async () => {
          setLoading(true);
          await onUpgrade();
          setLoading(false);
        }}
        className="w-full justify-center">
        Upgrade
      </Button>
    );
  }, [
    currentPlan,
    hasActiveSubscription,
    isCurrentPlan,
    isOtherPaidPlan,
    isTrialActive,
    loading,
    onManageSubscription,
    onUpgrade,
    plan.featured,
    plan.id,
  ]);

  // Determine badge to show
  const getBadge = () => {
    // Active trial badge
    if (isTrialActive && plan.id === "scale") {
      return (
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          Active trial
        </span>
      );
    }

    // Current plan badge (for paid plans)
    if (isCurrentPlan && plan.id !== "free") {
      return (
        <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700">
          Current plan
        </span>
      );
    }

    // Only show "Most popular" if user is on Hobby plan
    if (plan.featured && currentPlan === "free" && !isCurrentPlan) {
      return (
        <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700">
          Most popular
        </span>
      );
    }

    return null;
  };

  // Highlight the current plan card or the featured card for Hobby users
  const shouldHighlight = isCurrentPlan || (plan.featured && currentPlan === "free");

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border",
        shouldHighlight ? "border-slate-900 bg-white shadow-lg" : "border-slate-200 bg-white"
      )}>
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-slate-600">{plan.name}</h3>
          {getBadge()}
        </div>

        {/* Price */}
        <div className="mt-4 flex items-baseline">
          <span className="text-4xl font-bold text-slate-900">{displayPrice}</span>
          {isMonetaryPrice && <span className="ml-1 text-sm text-slate-500">/ Month</span>}
        </div>

        {/* CTA Button */}
        <div className="mt-6">{CTAButton}</div>
      </div>

      {/* Usage Limits */}
      <div className="border-t border-slate-100 px-6 py-4">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Usage</p>
        <div className="mt-3 space-y-3">
          {plan.usageLimits.map((limit) => (
            <div
              key={limit.label}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex flex-col">
                <span className="text-sm text-slate-700">{limit.label}</span>
                {limit.overage && <span className="text-xs text-slate-400">Overage billing available</span>}
              </div>
              <span className="text-sm font-semibold text-slate-900">{limit.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="flex-1 border-t border-slate-100 px-6 py-4">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Features</p>
        <ul className="mt-3 space-y-2">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
              <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-500" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Addons (if any) */}
      {plan.addons && plan.addons.length > 0 && (
        <div className="border-t border-slate-100 px-6 py-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Available Add-ons</p>
          <ul className="mt-3 space-y-2">
            {plan.addons.map((addon) => (
              <li key={addon} className="flex items-start gap-2 text-sm text-slate-600">
                <PlusIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                <span>{addon}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmationModal
        title="Please reach out to us"
        open={contactModalOpen}
        setOpen={setContactModalOpen}
        onConfirm={() => setContactModalOpen(false)}
        buttonText="Close"
        buttonVariant="default"
        body="To switch your billing rhythm, please reach out to hola@formbricks.com"
      />
    </div>
  );
};
