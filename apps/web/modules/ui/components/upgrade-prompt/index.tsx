"use client";

import { KeyIcon } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { Button } from "@/modules/ui/components/button";

export type ModalButton = {
  text: string;
  href?: string;
  onClick?: () => void;
};

interface UpgradePromptProps {
  title: string;
  description?: string;
  buttons: [ModalButton, ModalButton];
  feature?: string;
}

export const UpgradePrompt = ({ title, description, buttons, feature }: UpgradePromptProps) => {
  const [primaryButton, secondaryButton] = buttons;

  const handlePrimaryClick = () => {
    if (posthog.__loaded && feature) {
      posthog.capture("upgrade_cta_clicked", { feature });
    }
    primaryButton.onClick?.();
  };

  return (
    <div className="flex w-full flex-col items-center gap-6 p-6">
      <div className="rounded-md border border-slate-200 p-3">
        <KeyIcon className="h-6 w-6 text-slate-900" />
      </div>
      <div className="flex max-w-[80%] flex-col items-center gap-2 text-center">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex gap-3">
        {primaryButton.href ? (
          <Button asChild>
            <Link
              href={primaryButton.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handlePrimaryClick}>
              {primaryButton.text}
            </Link>
          </Button>
        ) : (
          <Button onClick={handlePrimaryClick}>{primaryButton.text}</Button>
        )}
        {secondaryButton.href ? (
          <Button variant="secondary" asChild>
            <Link href={secondaryButton.href} target="_blank" rel="noopener noreferrer">
              {secondaryButton.text}
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" onClick={secondaryButton.onClick}>
            {secondaryButton.text}
          </Button>
        )}
      </div>
    </div>
  );
};
