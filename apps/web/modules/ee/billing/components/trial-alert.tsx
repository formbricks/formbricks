"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Alert, AlertTitle } from "@/modules/ui/components/alert";

type TrialAlertVariant = "error" | "warning" | "info";

const getTrialVariant = (daysRemaining: number): TrialAlertVariant => {
  if (daysRemaining <= 3) return "error";
  if (daysRemaining <= 7) return "warning";
  return "info";
};

interface TrialAlertProps {
  trialDaysRemaining: number;
  size?: "small";
  className?: string;
  children?: React.ReactNode;
}

export const TrialAlert = ({ trialDaysRemaining, size, className, children }: Readonly<TrialAlertProps>) => {
  const { t } = useTranslation();

  const title = useMemo(() => {
    if (trialDaysRemaining <= 0) return t("common.trial_expired");
    if (trialDaysRemaining === 1) return t("common.trial_one_day_remaining");
    return t("common.trial_days_remaining", { count: trialDaysRemaining });
  }, [trialDaysRemaining, t]);

  const variant = getTrialVariant(trialDaysRemaining);

  return (
    <Alert variant={variant} size={size} className={cn("max-w-4xl", className)}>
      <AlertTitle>{title}</AlertTitle>
      {children}
    </Alert>
  );
};
