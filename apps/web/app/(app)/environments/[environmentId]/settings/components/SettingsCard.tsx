"use client";

import { cn } from "@/lib/cn";
import { Badge } from "@/modules/ui/components/badge";
import { Description } from "@/modules/ui/components/description";
import { Title } from "@/modules/ui/components/title";
import { useTranslate } from "@tolgee/react";

export const SettingsCard = ({
  title,
  description,
  children,
  soon = false,
  noPadding = false,
  beta,
  className,
}: {
  title: string;
  description: string;
  children: any;
  soon?: boolean;
  noPadding?: boolean;
  beta?: boolean;
  className?: string;
}) => {
  const { t } = useTranslate();
  return (
    <div
      className={cn(
        "relative my-4 w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 text-left shadow-sm",
        className
      )}
      id={title}>
      <div className="border-b border-slate-200 px-4 pb-4">
        <div className="flex">
          <Title capitalize>{title}</Title>
          <div className="ml-2">
            {beta && <Badge size="normal" type="warning" text="Beta" />}
            {soon && (
              <Badge size="normal" type="success" text={t("environments.settings.enterprise.coming_soon")} />
            )}
          </div>
        </div>
        <Description>{description}</Description>
      </div>
      <div className={cn(noPadding ? "" : "px-4 pt-4")}>{children}</div>
    </div>
  );
};
