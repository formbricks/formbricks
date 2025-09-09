"use client";

import { cn } from "@/lib/cn";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { H4, Small } from "@/modules/ui/components/typography";
import { useTranslate } from "@tolgee/react";

interface ButtonInfo {
  text: string;
  onClick: () => void;
  variant: "secondary" | "default" | "outline" | "ghost" | "link";
}

export const SettingsCard = ({
  title,
  description,
  children,
  soon = false,
  noPadding = false,
  beta,
  className,
  buttonInfo,
}: {
  title: string;
  description: string;
  children: any;
  soon?: boolean;
  noPadding?: boolean;
  beta?: boolean;
  className?: string;
  buttonInfo?: ButtonInfo;
}) => {
  const { t } = useTranslate();
  return (
    <div
      className={cn(
        "relative my-4 w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 text-left shadow-sm",
        className
      )}
      id={title}>
      <div className="flex justify-between border-b border-slate-200 px-4 pb-4">
        <div>
          <H4 className="font-medium capitalize tracking-normal">{title}</H4>
          <div className="ml-2">
            {beta && <Badge size="normal" type="warning" text="Beta" />}
            {soon && (
              <Badge size="normal" type="success" text={t("environments.settings.enterprise.coming_soon")} />
            )}
          </div>
          <Small color="muted" margin="headerDescription">
            {description}
          </Small>
        </div>
        {buttonInfo && (
          <Button type="button" onClick={buttonInfo?.onClick} variant={buttonInfo?.variant ?? "default"}>
            {buttonInfo?.text}
          </Button>
        )}
      </div>
      <div className={cn(noPadding ? "" : "px-4 pt-4")}>{children}</div>
    </div>
  );
};
