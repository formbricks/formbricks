"use client";

import { Button } from "@/modules/ui/components/button";
import { Confetti } from "@/modules/ui/components/confetti";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface ConfirmationPageProps {
  environmentId: string;
}

export const ConfirmationPage = ({ environmentId }: ConfirmationPageProps) => {
  const { t } = useTranslate();
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    setShowConfetti(true);
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
          <Link href={`/environments/${environmentId}/settings/billing`}>
            {t("billing_confirmation.back_to_billing_overview")}
          </Link>
        </Button>
      </div>
    </div>
  );
};
