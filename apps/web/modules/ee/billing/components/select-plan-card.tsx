"use client";

import { CheckIcon, GiftIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import calLogo from "@/images/customer-logos/cal-logo-light.svg";
import ethereumLogo from "@/images/customer-logos/ethereum-logo.png";
import flixbusLogo from "@/images/customer-logos/flixbus-white.svg";
import githubLogo from "@/images/customer-logos/github-logo.png";
import siemensLogo from "@/images/customer-logos/siemens.png";
import { startHobbyAction, startProTrialAction } from "@/modules/ee/billing/actions";
import { PLAN_VARIANTS, type TPlanVariant } from "@/modules/ee/billing/lib/select-plan-variants";
import { Button } from "@/modules/ui/components/button";

interface SelectPlanCardProps {
  nextUrl: string;
  organizationId: string;
  variant?: TPlanVariant;
}

const CUSTOMER_LOGOS = [
  { src: siemensLogo, alt: "Siemens" },
  { src: calLogo, alt: "Cal.com" },
  { src: flixbusLogo, alt: "FlixBus" },
  { src: githubLogo, alt: "GitHub" },
  { src: ethereumLogo, alt: "Ethereum" },
];

export const SelectPlanCard = ({ nextUrl, organizationId, variant = "a" }: SelectPlanCardProps) => {
  const router = useRouter();
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [isStartingHobby, setIsStartingHobby] = useState(false);
  const { t } = useTranslation();
  const config = PLAN_VARIANTS[variant];

  const isVariantB = variant === "b";

  const title = isVariantB
    ? t("workspace.settings.billing.select_plan_variant_b_title")
    : t("workspace.settings.billing.trial_title");

  const subtitle = isVariantB ? null : t("workspace.settings.billing.trial_no_credit_card");

  const cta = isVariantB
    ? t("workspace.settings.billing.select_plan_variant_b_cta")
    : t("common.start_free_trial");

  const skip = t("workspace.settings.billing.select_plan_variant_b_skip");

  const TRIAL_FEATURE_KEYS = [
    t("workspace.settings.billing.trial_feature_unlimited_seats"),
    t("workspace.settings.billing.trial_feature_hide_branding"),
    t("workspace.settings.billing.trial_feature_respondent_identification"),
    t("workspace.settings.billing.trial_feature_contact_segment_management"),
    t("workspace.settings.billing.trial_feature_attribute_segmentation"),
    t("workspace.settings.billing.trial_feature_mobile_sdks"),
    t("workspace.settings.billing.trial_feature_email_followups"),
    t("workspace.settings.billing.trial_feature_webhooks"),
    t("workspace.settings.billing.trial_feature_api_access"),
    t("workspace.settings.billing.trial_feature_unify_feedback"),
    t("workspace.settings.billing.trial_feature_feedback_directories"),
    t("workspace.settings.billing.trial_feature_dashboards"),
  ] as const;

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
    <div className="flex w-full max-w-md flex-col items-center space-y-6">
      <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex flex-col items-center space-y-6 p-8">
          <div className="rounded-full bg-slate-100 p-4">
            <GiftIcon className="h-10 w-10 text-slate-600" />
          </div>

          <div className="text-center">
            <h3 className="text-2xl font-semibold text-slate-800">{title}</h3>
            {subtitle && <p className="mt-2 text-slate-600">{subtitle}</p>}
          </div>

          {config.showFeatures && (
            <ul className="w-full space-y-3 text-left">
              {TRIAL_FEATURE_KEYS.map((key) => (
                <li key={key} className="flex items-center gap-3 text-slate-700">
                  <CheckIcon className="h-5 w-5 flex-shrink-0 text-slate-900" />
                  <span>{key}</span>
                </li>
              ))}
            </ul>
          )}

          <Button
            size="lg"
            onClick={handleStartTrial}
            className="mt-4 w-full"
            loading={isStartingTrial}
            disabled={isStartingTrial || isStartingHobby}>
            {cta}
          </Button>
        </div>

        {config.showLogos && (
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
        )}
      </div>

      <button
        onClick={handleContinueHobby}
        disabled={isStartingTrial || isStartingHobby}
        className="text-sm text-slate-400 underline-offset-2 transition-colors hover:text-slate-600 hover:underline">
        {isStartingHobby ? t("common.loading") : skip}
      </button>
    </div>
  );
};
