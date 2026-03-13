"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertTitle } from "@/modules/ui/components/alert";

type TrialAlertVariant = "error" | "warning" | "info" | "success";

const getTrialVariant = (daysRemaining: number): TrialAlertVariant => {
  if (daysRemaining <= 3) return "error";
  if (daysRemaining <= 7) return "warning";
  return "info";
};

interface TrialAlertProps {
  trialDaysRemaining: number;
  size?: "small";
  hasPaymentMethod?: boolean;
  children?: React.ReactNode;
}

export const TrialAlert = ({
  trialDaysRemaining,
  size,
  hasPaymentMethod = false,
  children,
}: TrialAlertProps) => {
  const { t } = useTranslation();

  const title = useMemo(() => {
    if (trialDaysRemaining <= 0) return t("common.trial_expired");
    if (trialDaysRemaining === 1) return t("common.trial_one_day_remaining");
    return t("common.trial_days_remaining", { count: trialDaysRemaining });
  }, [trialDaysRemaining, t]);

  const variant = hasPaymentMethod ? "success" : getTrialVariant(trialDaysRemaining);

  return (
    <Alert variant={variant} size={size}>
      <AlertTitle>{title}</AlertTitle>
      {children}
    </Alert>
  );
};
