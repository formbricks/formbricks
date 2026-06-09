"use client";

import { Trans, useTranslation } from "react-i18next";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { getResponsePricingTiers } from "../lib/response-pricing-tiers";

type TResponsePricingPlan = "pro" | "scale";

interface ResponsePricingTooltipProps {
  plan: TResponsePricingPlan;
  locale: string;
  currency: string;
}

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

const ResponsePricingTable = ({ plan, locale, currency }: Readonly<ResponsePricingTooltipProps>) => {
  const { t } = useTranslation();
  const tiers = getResponsePricingTiers(plan);

  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th className="pb-2 pr-4 font-medium">
            {t("workspace.settings.billing.dynamic_pricing_first_unit")}
          </th>
          <th className="pb-2 pr-4 font-medium">
            {t("workspace.settings.billing.dynamic_pricing_last_unit")}
          </th>
          <th className="pb-2 font-medium">{t("workspace.settings.billing.dynamic_pricing_per_unit")}</th>
        </tr>
      </thead>
      <tbody>
        {tiers.map((tier) => (
          <tr key={`${tier.firstUnit}-${tier.lastUnit ?? "unlimited"}`} className="text-slate-700">
            <td className="py-1 pr-4 tabular-nums">{formatTierUnit(tier.firstUnit, locale)}</td>
            <td className="py-1 pr-4 tabular-nums">
              {tier.lastUnit === null
                ? t("workspace.settings.billing.dynamic_pricing_unlimited")
                : formatTierUnit(tier.lastUnit, locale)}
            </td>
            <td className="py-1 tabular-nums">{formatPerUnitPrice(tier.perUnitCents, currency, locale)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

interface PlanResponseFeatureProps {
  plan: TResponsePricingPlan;
  locale: string;
  currency: string;
}

export const PlanResponseFeature = ({ plan, locale, currency }: Readonly<PlanResponseFeatureProps>) => {
  const i18nKey =
    plan === "pro"
      ? "workspace.settings.billing.plan_pro_feature_responses"
      : "workspace.settings.billing.plan_scale_feature_responses";

  return (
    <Trans
      i18nKey={i18nKey}
      components={{
        dynamicPricing: (
          <TooltipRenderer
            tooltipContent={<ResponsePricingTable plan={plan} locale={locale} currency={currency} />}
            className="max-w-none p-3"
            triggerClass="cursor-help border-b border-dotted border-slate-400">
            <span />
          </TooltipRenderer>
        ),
      }}
    />
  );
};
