"use client";

import { CheckIcon, GiftIcon, XCircleIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import calLogo from "@/images/customer-logos/cal-logo-light.svg";
import ethereumLogo from "@/images/customer-logos/ethereum-logo.png";
import flixbusLogo from "@/images/customer-logos/flixbus-white.svg";
import githubLogo from "@/images/customer-logos/github-logo.png";
import siemensLogo from "@/images/customer-logos/siemens.png";
import { getPostHogClientFeatureFlag } from "@/lib/posthog/client";
import { startHobbyAction, startProTrialAction } from "@/modules/ee/billing/actions";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface SelectPlanCardProps {
  nextUrl: string;
  organizationId: string;
  featureVariant: "control" | "variant_b";
  ctaVariant: "control" | "variant_b" | "variant_c" | "variant_d";
}

const CUSTOMER_LOGOS = [
  { src: siemensLogo, alt: "Siemens" },
  { src: calLogo, alt: "Cal.com" },
  { src: flixbusLogo, alt: "FlixBus" },
  { src: githubLogo, alt: "GitHub" },
  { src: ethereumLogo, alt: "Ethereum" },
];

export const SelectPlanCard = ({
  nextUrl,
  organizationId,
  featureVariant,
  ctaVariant,
}: Readonly<SelectPlanCardProps>) => {
  const router = useRouter();
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [isStartingHobby, setIsStartingHobby] = useState(false);
  const [showHobbyConfirm, setShowHobbyConfirm] = useState(false);
  const [hobbyConfirmEnabled, setHobbyConfirmEnabled] = useState(false);
  useEffect(() => {
    return posthog.onFeatureFlags(() => {
      setHobbyConfirmEnabled(getPostHogClientFeatureFlag("a-b_billing_hobby-downgrade-confirm") === "test");
    });
  }, []);
  const { t } = useTranslation();
  let ctaCopy: string;
  if (ctaVariant === "variant_b") {
    ctaCopy = t("workspace.settings.billing.select_plan_cta_variant_b");
  } else if (ctaVariant === "variant_c") {
    ctaCopy = t("workspace.settings.billing.select_plan_cta_variant_c");
  } else if (ctaVariant === "variant_d") {
    ctaCopy = t("workspace.settings.billing.select_plan_cta_variant_d");
  } else {
    ctaCopy = t("workspace.settings.billing.select_plan_cta");
  }

  const copy = {
    header: t("workspace.settings.billing.select_plan_header"),
    subheader: t("workspace.settings.billing.select_plan_subheader"),
    cta: ctaCopy,
    skip: t("workspace.settings.billing.select_plan_skip"),
  };

  const SELECT_PLAN_FEATURE_KEYS =
    featureVariant === "variant_b"
      ? [
          t("workspace.settings.billing.select_plan_variant_b_feature_1"),
          t("workspace.settings.billing.select_plan_variant_b_feature_2"),
          t("workspace.settings.billing.select_plan_variant_b_feature_3"),
          t("workspace.settings.billing.select_plan_variant_b_feature_4"),
        ]
      : [
          t("workspace.settings.billing.select_plan_feature_1"),
          t("workspace.settings.billing.select_plan_feature_2"),
          t("workspace.settings.billing.select_plan_feature_3"),
        ];

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    try {
      const result = await startProTrialAction({ organizationId });
      if (result?.data) {
        router.push(nextUrl);
      } else if (result?.serverError === "trial_already_used") {
        toast.error(t("workspace.settings.billing.trial_already_used"));
        setIsStartingTrial(false);
      } else {
        toast.error(t("workspace.settings.billing.failed_to_start_trial"));
        setIsStartingTrial(false);
      }
    } catch {
      toast.error(t("workspace.settings.billing.failed_to_start_trial"));
      setIsStartingTrial(false);
    }
  };

  const handleContinueHobby = async () => {
    setIsStartingHobby(true);
    try {
      const result = await startHobbyAction({ organizationId });
      if (result?.data) {
        router.push(nextUrl);
      } else {
        toast.error(t("common.something_went_wrong_please_try_again"));
        setIsStartingHobby(false);
      }
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
      setIsStartingHobby(false);
    }
  };

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-y-6">
      <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex flex-col items-center gap-y-6 p-8">
          <div className="rounded-full bg-slate-100 p-4">
            <GiftIcon className="size-10 text-slate-600" />
          </div>

          <div className="text-center">
            <h3 className="text-2xl font-semibold text-slate-800">{copy.header}</h3>
            <p className="mt-2 text-slate-600">{copy.subheader}</p>
          </div>

          <ul className="my-3 w-full space-y-3 text-left">
            {SELECT_PLAN_FEATURE_KEYS.map((key) => (
              <li key={key} className="flex items-center gap-3 text-slate-700">
                <CheckIcon className="size-5 flex-shrink-0 text-slate-900" />
                <span>{key}</span>
              </li>
            ))}
          </ul>

          <Button
            size="lg"
            onClick={handleStartTrial}
            className="mt-4 w-full"
            loading={isStartingTrial}
            disabled={isStartingTrial || isStartingHobby}>
            {copy.cta}
          </Button>
        </div>

        <div className="w-full overflow-hidden border-t border-slate-100 bg-slate-50 py-4">
          <div className="flex w-max animate-logo-scroll gap-12 hover:[animation-play-state:paused]">
            {[...CUSTOMER_LOGOS, ...CUSTOMER_LOGOS].map((logo, index) => (
              <div
                key={`${logo.alt}-${index}`}
                className="flex h-5 items-center opacity-50 grayscale transition-all duration-200 hover:opacity-100 hover:grayscale-0">
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  height={20}
                  width={100}
                  className="h-5 w-auto max-w-[100px] object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => (hobbyConfirmEnabled ? setShowHobbyConfirm(true) : void handleContinueHobby())}
        disabled={isStartingTrial || isStartingHobby}
        className="text-sm text-slate-400 underline-offset-2 transition-colors hover:text-slate-600 hover:underline">
        {isStartingHobby && !hobbyConfirmEnabled ? t("common.loading") : copy.skip}
      </button>

      <Dialog open={showHobbyConfirm} onOpenChange={setShowHobbyConfirm}>
        <DialogContent width="narrow" hideCloseButton>
          <DialogHeader>
            <DialogTitle>{t("workspace.settings.billing.hobby_confirm_title")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-slate-500">{t("workspace.settings.billing.hobby_confirm_description")}</p>
            <ul className="mt-4 space-y-1.5">
              {[
                t("workspace.settings.billing.hobby_confirm_feature_responses"),
                t("workspace.settings.billing.hobby_confirm_feature_branding"),
                t("workspace.settings.billing.hobby_confirm_feature_contacts"),
                t("workspace.settings.billing.hobby_confirm_feature_ai"),
                t("workspace.settings.billing.hobby_confirm_feature_seats"),
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                  <XCircleIcon className="size-3.5 shrink-0 text-red-400" />
                  {item}
                </li>
              ))}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                posthog.capture("billing_onboarding_hobby_confirm_cta_clicked", { cta: "start_trial" });
                setShowHobbyConfirm(false);
                void handleStartTrial();
              }}>
              {t("workspace.settings.billing.hobby_confirm_start_trial")}
            </Button>
            <Button
              variant="destructive"
              loading={isStartingHobby}
              onClick={() => {
                posthog.capture("billing_onboarding_hobby_confirm_cta_clicked", { cta: "downgrade_hobby" });
                void handleContinueHobby();
              }}>
              {t("workspace.settings.billing.hobby_confirm_downgrade")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
