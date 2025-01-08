"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { TSurveySingleUse } from "@formbricks/types/surveys/types";
import footerLogo from "../lib/footerlogo.svg";

interface SurveyLinkUsedProps {
  singleUseMessage: TSurveySingleUse | null;
}

export const SurveyLinkUsed = ({ singleUseMessage }: SurveyLinkUsedProps) => {
  const t = useTranslations();
  const defaultHeading = t("s.survey_already_answered_heading");
  const defaultSubheading = t("s.survey_already_answered_subheading");
  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-gradient-to-tr from-slate-200 to-slate-50 py-8 text-center">
      <div></div>
      <div className="flex flex-col items-center space-y-3 text-slate-300">
        <CheckCircle2Icon className="h-20 w-20" />
        <h1 className="text-4xl font-bold text-slate-800">{singleUseMessage?.heading ?? defaultHeading}</h1>
        <p className="text-lg leading-10 text-slate-500">
          {singleUseMessage?.subheading ?? defaultSubheading}
        </p>
      </div>
      <div>
        <Link href="https://formbricks.com">
          <Image src={footerLogo as string} alt="Brand logo" className="mx-auto w-40" />
        </Link>
      </div>
    </div>
  );
};
