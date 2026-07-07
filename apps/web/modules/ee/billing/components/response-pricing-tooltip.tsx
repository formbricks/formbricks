"use client";

import type { TFunction } from "i18next";
import { Trans, useTranslation } from "react-i18next";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import type { TResponseOverageDisplay } from "../lib/stripe-billing-catalog";

type TResponsePricingPlan = "pro" | "scale";

const formatTierUnit = (value: number, locale: string) => {
  return value.toLocaleString(locale);
};

const formatPerUnitPrice = (perUnitCents: number, currency: string, locale: string) => {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(perUnitCents / 100);
};

const ResponsePricingTable = ({
  overage,
  locale,
}: Readonly<{ overage: TResponseOverageDisplay; locale: string }>) => {
  const { t } = useTranslation();

  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th className="pr-4 pb-2 font-medium">
            {t("workspace.settings.billing.dynamic_pricing_first_unit")}
          </th>
          <th className="pr-4 pb-2 font-medium">
            {t("workspace.settings.billing.dynamic_pricing_last_unit")}
          </th>
          <th className="pb-2 font-medium">{t("workspace.settings.billing.dynamic_pricing_per_unit")}</th>
        </tr>
      </thead>
      <tbody>
        {overage.tiers.map((tier) => (
          <tr key={`${tier.firstUnit}-${tier.lastUnit ?? "unlimited"}`} className="text-slate-700">
            <td className="py-1 pr-4 tabular-nums">{formatTierUnit(tier.firstUnit, locale)}</td>
            <td className="py-1 pr-4 tabular-nums">
              {tier.lastUnit === null
                ? t("workspace.settings.billing.dynamic_pricing_unlimited")
                : formatTierUnit(tier.lastUnit, locale)}
            </td>
            <td className="py-1 tabular-nums">
              {formatPerUnitPrice(tier.perUnitCents, overage.currency, locale)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

interface PlanResponseFeatureProps {
  plan: TResponsePricingPlan;
  locale: string;
  overage: TResponseOverageDisplay | null;
  t: TFunction;
}

// The <span /> placeholder child is replaced by react-i18next's <Trans> with
// the translated text inside the <dynamicPricing> tag.
const dynamicPricingComponent = (overage: TResponseOverageDisplay | null, locale: string) => {
  if (!overage) {
    return <span />;
  }

  return (
    <TooltipRenderer
      tooltipContent={<ResponsePricingTable overage={overage} locale={locale} />}
      className="max-w-none p-3"
      triggerClass="cursor-help border-b border-dotted border-slate-400">
      <span />
    </TooltipRenderer>
  );
};

export const PlanResponseFeature = ({ plan, locale, overage, t }: Readonly<PlanResponseFeatureProps>) => {
  const i18nKey =
    plan === "pro"
      ? t("workspace.settings.billing.plan_pro_feature_responses")
      : t("workspace.settings.billing.plan_scale_feature_responses");

  return (
    <Trans i18nKey={i18nKey} components={{ dynamicPricing: dynamicPricingComponent(overage, locale) }} />
  );
};
