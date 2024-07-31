import { CheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TOrganization, TOrganizationBillingPeriod } from "@formbricks/types/organizations";
import { Badge } from "../Badge";
import { Button } from "../Button";
import { ConfirmationModal } from "../ConfirmationModal";

interface PricingCardProps {
  plan: {
    id: string;
    name: string;
    featured: boolean;
    price: {
      monthly: string;
      yearly: string;
    };
    mainFeatures: string[];
    href: string;
  };
  planPeriod: TOrganizationBillingPeriod;
  organization: TOrganization;
  onUpgrade: () => Promise<void>;
  onManageSubscription: () => Promise<void>;
  productFeatureKeys: {
    FREE: string;
    STARTUP: string;
    SCALE: string;
    ENTERPRISE: string;
  };
}

export const PricingCard = ({
  planPeriod,
  plan,
  onUpgrade,
  onManageSubscription,
  organization,
  productFeatureKeys,
}: PricingCardProps) => {
  const [loading, setLoading] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const isCurrentPlan = useMemo(() => {
    if (organization.billing.plan === productFeatureKeys.FREE && plan.id === productFeatureKeys.FREE) {
      return true;
    }

    if (
      organization.billing.plan === productFeatureKeys.ENTERPRISE &&
      plan.id === productFeatureKeys.ENTERPRISE
    ) {
      return true;
    }

    return organization.billing.plan === plan.id && organization.billing.period === planPeriod;
  }, [
    organization.billing.period,
    organization.billing.plan,
    plan.id,
    planPeriod,
    productFeatureKeys.ENTERPRISE,
    productFeatureKeys.FREE,
  ]);

  const CTAButton = useMemo(() => {
    if (isCurrentPlan) {
      return null;
    }

    if (plan.id !== productFeatureKeys.ENTERPRISE && plan.id !== productFeatureKeys.FREE) {
      if (organization.billing.plan === productFeatureKeys.FREE) {
        return (
          <Button
            loading={loading}
            onClick={async () => {
              setLoading(true);
              await onUpgrade();
              setLoading(false);
            }}
            className="flex justify-center">
            Start Free Trial
          </Button>
        );
      }

      return (
        <Button
          loading={loading}
          onClick={() => {
            setUpgradeModalOpen(true);
          }}
          className="flex justify-center">
          Switch Plan
        </Button>
      );
    }

    return <></>;
  }, [
    isCurrentPlan,
    loading,
    onUpgrade,
    organization.billing.plan,
    plan.id,
    productFeatureKeys.ENTERPRISE,
    productFeatureKeys.FREE,
  ]);

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
          {isCurrentPlan && <Badge text="Current Plan" type="success" size="normal" />}
        </div>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between lg:flex-col lg:items-stretch">
          <div className="mt-2 flex items-center gap-x-4">
            <p
              className={cn(
                plan.featured ? "text-slate-900" : "text-slate-800",
                "text-4xl font-bold tracking-tight"
              )}>
              {planPeriod === "monthly" ? plan.price.monthly : plan.price.yearly}
            </p>
            {plan.name !== "Enterprise" && (
              <div className="text-sm leading-5">
                <p className={plan.featured ? "text-slate-900" : "text-slate-800"}>/ Month</p>
                <p className={plan.featured ? "text-slate-500" : "text-slate-400"}>{`Billed ${
                  planPeriod === "monthly" ? "monthly" : "yearly"
                }`}</p>
              </div>
            )}
          </div>

          {CTAButton}

          {plan.id !== productFeatureKeys.FREE && isCurrentPlan && (
            <Button
              variant="secondary"
              loading={loading}
              onClick={async () => {
                setLoading(true);
                await onManageSubscription();
                setLoading(false);
              }}
              className="flex justify-center">
              Manage Subscription
            </Button>
          )}

          {organization.billing.plan !== plan.id && plan.id === productFeatureKeys.ENTERPRISE && (
            <Button loading={loading} onClick={() => onUpgrade()} className="flex justify-center">
              Contact Us
            </Button>
          )}
        </div>
        <div className="mt-8 flow-root sm:mt-10">
          <ul
            role="list"
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

      <ConfirmationModal
        title="Switch Plan"
        buttonText="Confirm"
        onConfirm={async () => {
          setLoading(true);
          await onUpgrade();
          setLoading(false);
          setUpgradeModalOpen(false);
        }}
        open={upgradeModalOpen}
        setOpen={setUpgradeModalOpen}
        text={`Are you sure you want to switch to the ${plan.name} plan? You will be charged ${
          planPeriod === "monthly" ? plan.price.monthly : plan.price.yearly
        } per month.`}
        buttonVariant="primary"
        buttonLoading={loading}
        closeOnOutsideClick={false}
        hideCloseButton
      />
    </div>
  );
};
