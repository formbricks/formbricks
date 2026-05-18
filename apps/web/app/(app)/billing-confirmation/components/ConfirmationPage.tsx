"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Confetti } from "@/modules/ui/components/confetti";

const BILLING_CONFIRMATION_WORKSPACE_ID_KEY = "billingConfirmationWorkspaceId";

export const ConfirmationPage = () => {
  const { t } = useTranslation();
  const [showConfetti, setShowConfetti] = useState(false);
  const [resolvedWorkspaceId, setResolvedWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    setShowConfetti(true);

    if (globalThis.window === undefined) {
      return;
    }

    const storedWorkspaceId = globalThis.window.sessionStorage.getItem(BILLING_CONFIRMATION_WORKSPACE_ID_KEY);
    if (storedWorkspaceId) {
      setResolvedWorkspaceId(storedWorkspaceId);
    }
  }, []);

  return (
    <div className="h-full w-full">
      {showConfetti && <Confetti />}
      <div className="mx-auto max-w-sm py-8 sm:px-6 lg:px-8">
        <div className="my-6 sm:flex-auto">
          <h1 className="text-center text-xl font-semibold text-slate-900">
            {t("billing_confirmation.upgrade_successful")}
          </h1>
          <p className="mt-2 text-center text-sm text-slate-700">
            {t("billing_confirmation.thanks_for_upgrading")}
          </p>
        </div>
        <Button asChild className="w-full justify-center">
          <Link
            href={
              resolvedWorkspaceId ? `/workspaces/${resolvedWorkspaceId}/settings/organization/billing` : "/"
            }>
            {t("billing_confirmation.back_to_billing_overview")}
          </Link>
        </Button>
      </div>
    </div>
  );
};
