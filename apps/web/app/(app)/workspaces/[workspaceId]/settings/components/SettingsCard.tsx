"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { H4, Small } from "@/modules/ui/components/typography";

interface ButtonInfo {
  text: string;
  onClick: () => void;
  variant: "secondary" | "default" | "outline" | "ghost" | "link";
}

/**
 * How the card treats its body:
 * - `padded` — the default `px-4 pt-4` gutter, for ordinary form content.
 * - `bleed` — no gutter; the child supplies its own padding.
 * - `flush` — no gutter *and* no bottom padding, so edge-to-edge content (a table) meets the card's
 *   bottom border. Pairs with `overflow-hidden` on the card, which clips the content with the card's
 *   own inner radius — a `rounded-b-*` on the child would be off by the border width.
 */
export type TSettingsCardBodyVariant = "padded" | "bleed" | "flush";

const BODY_VARIANT_CLASSES: Record<TSettingsCardBodyVariant, string> = {
  padded: "px-4 pt-4",
  bleed: "",
  flush: "-mb-4",
};

export const SettingsCard = ({
  title,
  description,
  children,
  soon = false,
  bodyVariant = "padded",
  beta,
  className,
  buttonInfo,
  cta,
}: {
  title: string;
  description: string;
  children: any;
  soon?: boolean;
  bodyVariant?: TSettingsCardBodyVariant;
  beta?: boolean;
  className?: string;
  buttonInfo?: ButtonInfo;
  cta?: React.ReactNode;
}) => {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "relative my-4 w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 text-left shadow-xs",
        bodyVariant === "flush" && "overflow-hidden",
        className
      )}
      id={title}>
      <div className="flex justify-between border-b border-slate-200 px-4 pb-4">
        <div>
          <H4 className="font-medium tracking-normal">{title}</H4>
          <div className="ml-2">
            {beta && <Badge size="normal" type="warning" text="Beta" />}
            {soon && (
              <Badge size="normal" type="success" text={t("workspace.settings.enterprise.coming_soon")} />
            )}
          </div>
          <Small color="muted" margin="headerDescription">
            {description}
          </Small>
        </div>
        {cta ??
          (buttonInfo && (
            <Button type="button" onClick={buttonInfo?.onClick} variant={buttonInfo?.variant ?? "default"}>
              {buttonInfo?.text}
            </Button>
          ))}
      </div>
      <div className={BODY_VARIANT_CLASSES[bodyVariant]}>{children}</div>
    </div>
  );
};
