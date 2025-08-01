"use client";

import { cn } from "@/lib/cn";
import { Project } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface ClientLogoProps {
  environmentId?: string;
  projectLogo: Project["logo"] | null;
  previewSurvey?: boolean;
}

export const ClientLogo = ({ environmentId, projectLogo, previewSurvey = false }: ClientLogoProps) => {
  const { t } = useTranslate();
  return (
    <div
      className={cn(previewSurvey ? "" : "left-3 top-3 md:left-7 md:top-7", "group absolute z-0 rounded-lg")}
      style={{ backgroundColor: projectLogo?.bgColor }}>
      {previewSurvey && environmentId && (
        <Link
          href={`/environments/${environmentId}/project/look`}
          className="group/link absolute h-full w-full hover:cursor-pointer"
          target="_blank">
          <ArrowUpRight
            size={24}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform rounded-md bg-white/80 p-0.5 text-slate-700 opacity-0 transition-all duration-200 ease-in-out group-hover/link:opacity-100"
          />
        </Link>
      )}
      {projectLogo?.url ? (
        <Image
          src={projectLogo?.url}
          className={cn(
            previewSurvey ? "max-h-12" : "max-h-16 md:max-h-20",
            "w-auto max-w-40 object-contain p-1 md:max-w-56"
          )}
          width={256}
          height={64}
          alt="Company Logo"
        />
      ) : (
        <Link
          href={`/environments/${environmentId}/project/look`}
          onClick={(e) => {
            if (!environmentId) {
              e.preventDefault();
            }
          }}
          className="whitespace-nowrap rounded-md border border-dashed border-slate-400 bg-slate-200 px-6 py-3 text-xs text-slate-900 opacity-50 backdrop-blur-sm hover:cursor-pointer hover:border-slate-600"
          target="_blank">
          {t("common.add_logo")}
        </Link>
      )}
    </div>
  );
};
