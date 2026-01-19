"use client";

import { CheckIcon, GiftIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import calLogo from "@/images/customer-logos/cal-logo-light.svg";
import ethereumLogo from "@/images/customer-logos/ethereum-logo.png";
import flixbusLogo from "@/images/customer-logos/flixbus-white.svg";
import githubLogo from "@/images/customer-logos/github-logo.png";
import siemensLogo from "@/images/customer-logos/siemens.png";
import { Button } from "@/modules/ui/components/button";

interface SelectPlanCardProps {
  /** URL to redirect after starting trial or continuing with free */
  nextUrl: string;
}

const TRIAL_FEATURES = [
  "Fully white-labeled surveys",
  "All team & collaboration features",
  "Setup custom webhooks",
  "Get full API access",
  "Setup email follow-ups",
  "Manage quotas",
];

const CUSTOMER_LOGOS = [
  { src: siemensLogo, alt: "Siemens" },
  { src: calLogo, alt: "Cal.com" },
  { src: flixbusLogo, alt: "FlixBus" },
  { src: githubLogo, alt: "GitHub" },
  { src: ethereumLogo, alt: "Ethereum" },
];

export const SelectPlanCard = ({ nextUrl }: SelectPlanCardProps) => {
  const router = useRouter();
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    // TODO: Implement trial activation via Stripe
    router.push(nextUrl);
  };

  const handleContinueFree = () => {
    router.push(nextUrl);
  };

  return (
    <div className="flex w-full max-w-md flex-col items-center space-y-6">
      {/* Trial Card */}
      <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex flex-col items-center space-y-6 p-8">
          {/* Gift Icon */}
          <div className="rounded-full bg-slate-100 p-4">
            <GiftIcon className="h-10 w-10 text-slate-600" />
          </div>

          {/* Title & Subtitle */}
          <div className="text-center">
            <h3 className="text-2xl font-semibold text-slate-800">Try Pro features for free!</h3>
            <p className="mt-2 text-slate-600">14 days trial, no credit card required</p>
          </div>

          {/* Features List */}
          <ul className="w-full space-y-3 text-left">
            {TRIAL_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-slate-700">
                <CheckIcon className="h-5 w-5 flex-shrink-0 text-slate-900" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {/* CTA Button */}
          <Button
            size="lg"
            onClick={handleStartTrial}
            className="mt-4 w-full"
            loading={isStartingTrial}
            disabled={isStartingTrial}>
            Start Free Trial
          </Button>
        </div>

        {/* Logo Carousel */}
        <div className="w-full overflow-hidden border-t border-slate-100 bg-slate-50 py-4">
          <div className="animate-logo-scroll flex w-max gap-12 hover:[animation-play-state:paused]">
            {/* Duplicate logos for seamless infinite scroll */}
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

      {/* Skip Option */}
      <button
        onClick={handleContinueFree}
        className="text-sm text-slate-400 underline-offset-2 transition-colors hover:text-slate-600 hover:underline">
        I want to stay on the Hobby plan
      </button>
    </div>
  );
};
