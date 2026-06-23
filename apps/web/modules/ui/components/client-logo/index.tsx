"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Workspace } from "@formbricks/database/prisma-browser";
import { TLogo } from "@formbricks/types/styling";
import { cn } from "@/lib/cn";

interface ClientLogoProps {
  workspaceLogo: Workspace["logo"] | null;
  workspaceId: string;
  surveyLogo?: TLogo | null;
  previewSurvey?: boolean;
  position?: "overlay" | "inline";
  dir?: "ltr" | "rtl" | "auto";
  /**
   * Render the logo without its own interactive links. Use this when the logo is wrapped
   * in a clickable parent (e.g. a button) to avoid nesting interactive elements.
   */
  disableLinks?: boolean;
}

export const ClientLogo = ({
  workspaceLogo,
  workspaceId,
  surveyLogo,
  previewSurvey = false,
  position = "overlay",
  dir = "auto",
  disableLinks = false,
}: Readonly<ClientLogoProps>) => {
  const { t } = useTranslation();
  const logoToUse = surveyLogo?.url ? surveyLogo : workspaceLogo;
  const lookSettingsHref = `/workspaces/${workspaceId}/settings/workspace/look`;

  let positionClasses = "";
  if (position === "overlay" && !previewSurvey) {
    if (dir === "rtl") {
      positionClasses = "top-3 right-3 md:top-7 md:right-7";
    } else {
      positionClasses = "top-3 left-3 md:top-7 md:left-7";
    }
  }

  return (
    <div
      className={cn(
        positionClasses,
        position === "overlay" ? "absolute z-0" : "relative",
        "group rounded-lg"
      )}
      style={{ backgroundColor: logoToUse?.bgColor }}>
      {previewSurvey && !disableLinks && (
        <Link
          href={lookSettingsHref}
          className="group/link absolute h-full w-full hover:cursor-pointer"
          target="_blank">
          <ArrowUpRight
            size={24}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform rounded-md bg-white/80 p-0.5 text-slate-700 opacity-0 transition-all duration-200 ease-in-out group-hover/link:opacity-100"
          />
        </Link>
      )}
      {logoToUse?.url ? (
        <Image
          src={logoToUse?.url}
          className={cn(
            previewSurvey ? "max-h-12" : "max-h-16 md:max-h-20",
            "w-auto max-w-40 object-contain p-1 md:max-w-56"
          )}
          width={256}
          height={64}
          alt="Company Logo"
        />
      ) : disableLinks ? (
        <span className="whitespace-nowrap rounded-md border border-dashed border-slate-400 bg-slate-200 px-6 py-3 text-xs text-slate-900 opacity-50 backdrop-blur-sm">
          {t("common.add_logo")}
        </span>
      ) : (
        <Link
          href={lookSettingsHref}
          className="whitespace-nowrap rounded-md border border-dashed border-slate-400 bg-slate-200 px-6 py-3 text-xs text-slate-900 opacity-50 backdrop-blur-sm hover:cursor-pointer hover:border-slate-600"
          target="_blank">
          {t("common.add_logo")}
        </Link>
      )}
    </div>
  );
};
