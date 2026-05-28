import { Workspace } from "@prisma/client";
import { CheckCircle2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { TSurveySingleUse } from "@formbricks/types/surveys/types";
import { getTranslate } from "@/lingodotdev/server";
import footerLogo from "../lib/footerlogo.svg";

interface SurveyCompletedMessageProps {
  singleUseMessage: TSurveySingleUse | null;
  workspace?: Pick<Workspace, "linkSurveyBranding">;
}

export const SurveyCompletedMessage = async ({
  singleUseMessage,
  workspace,
}: SurveyCompletedMessageProps) => {
  const t = await getTranslate();
  const defaultHeading = t("s.survey_already_answered_heading");
  const defaultSubheading = t("s.survey_already_answered_subheading");

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-gradient-to-tr from-slate-200 to-slate-50 py-8 text-center">
      <div className="my-auto flex flex-col items-center gap-y-3 text-slate-300">
        <CheckCircle2Icon className="size-20" />
        <h1 className="text-4xl font-bold text-slate-800">{singleUseMessage?.heading ?? defaultHeading}</h1>
        <p className="text-lg leading-10 text-slate-500">
          {singleUseMessage?.subheading ?? defaultSubheading}
        </p>
      </div>
      {(!workspace || workspace.linkSurveyBranding) && (
        <div>
          <Link href="https://formbricks.com">
            <Image src={footerLogo} alt="Brand logo" className="mx-auto w-40" />
          </Link>
        </div>
      )}
    </div>
  );
};
