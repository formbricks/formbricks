"use client";

import { InfoIcon } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Dialog, DialogContent } from "@/modules/ui/components/dialog";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

interface TrialResponseWarningModalProps {
  billingHref: string;
  responseCount: number;
}

export const TrialResponseWarningModal = ({ billingHref, responseCount }: TrialResponseWarningModalProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.cookie = `trial_warning_shown_250=true; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    setOpen(true);
    posthog.capture("trial_response_warning_shown", { threshold: "250", response_count: responseCount });
  }, [responseCount]);

  const handleDismiss = () => {
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleDismiss();
      }}>
      <DialogContent width="narrow">
        <div className="flex flex-col items-center gap-4 px-2 py-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-info-background p-3">
              <InfoIcon className="size-7 text-info" strokeWidth={1.5} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-slate-900">
                {t("workspace.settings.billing.trial_info_250_title")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("workspace.settings.billing.trial_info_250_description", {
                  responseCount: responseCount.toLocaleString(),
                })}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              asChild
              onClick={() => {
                posthog.capture("trial_response_warning_cta_clicked", {
                  threshold: "250",
                  cta: "add_billing_method",
                });
                handleDismiss();
              }}>
              <Link href={billingHref}>
                {t("workspace.settings.billing.trial_warning_add_billing_method")}
              </Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                posthog.capture("trial_response_warning_cta_clicked", {
                  threshold: "250",
                  cta: "remind_me_later",
                });
                handleDismiss();
              }}>
              {t("workspace.settings.billing.trial_warning_remind_me_later")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
