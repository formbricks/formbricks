"use client";

import { AlertTriangleIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Dialog, DialogContent } from "@/modules/ui/components/dialog";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

interface TrialResponseWarningModalProps {
  threshold: "200" | "250";
  billingHref: string;
  responseCount: number;
}

export const TrialResponseWarningModal = ({
  threshold,
  billingHref,
  responseCount,
}: TrialResponseWarningModalProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.cookie = `trial_warning_shown_${threshold}=true; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    setOpen(true);
    posthog.capture("trial_response_warning_shown", { threshold, response_count: responseCount });
  }, [threshold]);

  const handleDismiss = () => {
    setOpen(false);
  };

  const is250 = threshold === "250";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleDismiss();
      }}>
      <DialogContent width="narrow">
        <div className="flex flex-col items-center gap-5 px-2 py-4 text-center">
          <div className={`rounded-full p-3 ${is250 ? "bg-red-50" : "bg-amber-50"}`}>
            {is250 ? (
              <AlertTriangleIcon className="size-7 text-red-500" strokeWidth={1.5} />
            ) : (
              <ZapIcon className="size-7 text-amber-500" strokeWidth={1.5} />
            )}
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-slate-900">
              {is250
                ? t("workspace.settings.billing.trial_warning_100_title")
                : t("workspace.settings.billing.trial_warning_80_title")}
            </h2>
            <p className="text-sm text-slate-500">
              {is250
                ? t("workspace.settings.billing.trial_warning_100_description", {
                    responseCount: responseCount.toLocaleString(),
                  })
                : t("workspace.settings.billing.trial_warning_80_description", {
                    responseCount: responseCount.toLocaleString(),
                  })}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              asChild
              onClick={() => {
                posthog.capture("trial_response_warning_cta_clicked", {
                  threshold,
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
                  threshold,
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
