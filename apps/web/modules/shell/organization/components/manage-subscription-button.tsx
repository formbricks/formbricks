"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { manageSubscriptionAction } from "@/modules/ee/billing/actions";
import { Button } from "@/modules/ui/components/button";
import { getActionErrorMessage } from "../lib/action-result";

/** Opens the Stripe customer portal: plan changes, payment methods and invoices all live there. */
export const ManageSubscriptionButton = ({ organizationId }: Readonly<{ organizationId: string }>) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const openPortal = async () => {
    setIsLoading(true);
    try {
      const result = await manageSubscriptionAction({ organizationId });
      const message = getActionErrorMessage(result, t("common.something_went_wrong_please_try_again"));
      if (message || typeof result?.data !== "string") {
        toast.error(message ?? t("common.something_went_wrong_please_try_again"));
        setIsLoading(false);
        return;
      }
      globalThis.location.assign(result.data);
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={openPortal} loading={isLoading}>
      {t("shell.organization.billing.manage_subscription")}
    </Button>
  );
};
