"use client";

import { KeyIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { Button } from "@/modules/ui/components/button";

export type ModalButton = {
  text: string;
  href?: string;
  onClick?: () => void;
  /**
   * Whether `href` leaves the app. Upgrade targets are usually external forms, so this defaults to
   * true and keeps `target="_blank"`; in-app destinations (billing, organization settings) pass
   * false so they open in place.
   */
  isExternal?: boolean;
};

const externalLinkProps = (isExternal: boolean | undefined) =>
  isExternal === false ? {} : { target: "_blank", rel: "noopener noreferrer" };

interface UpgradePromptProps {
  title: string;
  description?: string;
  /** A second button is optional: some gates have nothing to offer beyond the primary action. */
  buttons: [ModalButton] | [ModalButton, ModalButton];
  feature?: string;
  icon?: LucideIcon;
}

export const UpgradePrompt = ({
  title,
  description,
  buttons,
  feature,
  icon: Icon = KeyIcon,
}: Readonly<UpgradePromptProps>) => {
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
        <Icon className="size-6 text-slate-900" />
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
              {...externalLinkProps(primaryButton.isExternal)}
              onClick={handlePrimaryClick}>
              {primaryButton.text}
            </Link>
          </Button>
        ) : (
          <Button onClick={handlePrimaryClick}>{primaryButton.text}</Button>
        )}
        {secondaryButton &&
          (secondaryButton.href ? (
            <Button variant="secondary" asChild>
              <Link href={secondaryButton.href} {...externalLinkProps(secondaryButton.isExternal)}>
                {secondaryButton.text}
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" onClick={secondaryButton.onClick}>
              {secondaryButton.text}
            </Button>
          ))}
      </div>
    </div>
  );
};
