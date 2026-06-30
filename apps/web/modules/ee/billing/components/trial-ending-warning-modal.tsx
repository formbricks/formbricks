"use client";

import { ClockIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Dialog, DialogContent } from "@/modules/ui/components/dialog";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days — long enough to outlive the trial's final days

interface TrialEndingWarningModalProps {
  daysRemaining: number;
  billingHref: string;
}

export const TrialEndingWarningModal = ({ daysRemaining, billingHref }: TrialEndingWarningModalProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.cookie = `trial_ending_shown_${daysRemaining}=true; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    setOpen(true);
    posthog.capture("trial_ending_warning_shown", { days_remaining: daysRemaining });
  }, [daysRemaining]);

  const handleDismiss = () => {
    setOpen(false);
  };

  const isLastDay = daysRemaining <= 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleDismiss();
      }}>
      <DialogContent width="narrow">
        <div className="flex flex-col items-center gap-4 px-2 py-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className={`rounded-full p-3 ${isLastDay ? "bg-red-50" : "bg-amber-50"}`}>
              <ClockIcon
                className={`size-7 ${isLastDay ? "text-red-500" : "text-amber-500"}`}
                strokeWidth={1.5}
              />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-slate-900">
                {t("workspace.settings.billing.trial_ending_title", { count: daysRemaining })}
              </h2>
              <p className="text-sm text-slate-500">
                {t("workspace.settings.billing.trial_ending_description")}
              </p>
            </div>
          </div>

          <ul className="w-full space-y-1.5 text-left">
            {[
              { from: "2,000", to: t("workspace.settings.billing.hobby_confirm_feature_responses") },
              { from: "3", to: t("workspace.settings.billing.hobby_confirm_feature_workspaces") },
            ].map((item) => (
              <li key={item.to} className="flex items-center gap-2 text-sm text-slate-700">
                <XCircleIcon className="size-3.5 shrink-0 text-primary" />
                <span>
                  <span className="text-slate-400 line-through">{item.from}</span>{" "}
                  <span aria-hidden="true">→</span> {item.to}
                </span>
              </li>
            ))}
            {[
              t("workspace.settings.billing.hobby_confirm_feature_branding"),
              t("workspace.settings.billing.hobby_confirm_feature_contacts"),
              t("workspace.settings.billing.hobby_confirm_feature_ai"),
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                <XCircleIcon className="size-3.5 shrink-0 text-primary" />
                <span className="text-slate-400 line-through">{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="secondary"
              onClick={() => {
                posthog.capture("trial_ending_warning_cta_clicked", {
                  days_remaining: daysRemaining,
                  cta: "remind_me_later",
                });
                handleDismiss();
              }}>
              {t("workspace.settings.billing.trial_warning_remind_me_later")}
            </Button>
            <Button
              asChild
              onClick={() => {
                posthog.capture("trial_ending_warning_cta_clicked", {
                  days_remaining: daysRemaining,
                  cta: "add_payment_method",
                });
                handleDismiss();
              }}>
              <Link href={billingHref}>
                {t("workspace.settings.billing.trial_ending_add_payment_method")}
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
