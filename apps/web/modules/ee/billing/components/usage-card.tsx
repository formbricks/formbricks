"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
import { BillingSlider } from "./billing-slider";

interface UsageCardProps {
  metric: string;
  currentCount: number;
  limit: number | null;
  isUnlimited: boolean;
  unlimitedLabel: string;
}

export const UsageCard = ({ metric, currentCount, limit, isUnlimited, unlimitedLabel }: UsageCardProps) => {
  const { t } = useTranslation();

  if (isUnlimited) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{metric}</p>
        <Badge type="success" size="normal" text={unlimitedLabel} />
      </div>
    );
  }

  if (!limit) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{metric}</p>
        <p className="text-sm text-slate-600">
          {currentCount.toLocaleString()} / {limit.toLocaleString()}{" "}
          <span className="text-slate-400">{t("environments.settings.billing.used")}</span>
        </p>
      </div>
      <BillingSlider value={currentCount} max={limit} />
    </div>
  );
};
