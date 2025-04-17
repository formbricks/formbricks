import { Button } from "@/modules/ui/components/button";
import { getTranslate } from "@/tolgee/server";
import { CheckCircle2Icon, HelpCircleIcon, PauseCircleIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { TSurveyClosedMessage } from "@formbricks/types/surveys/types";
import footerLogo from "../lib/footerlogo.svg";

export const SurveyInactive = async ({
  status,
  surveyClosedMessage,
}: {
  status: "paused" | "completed" | "link invalid" | "scheduled" | "response submitted";
  surveyClosedMessage?: TSurveyClosedMessage | null;
}) => {
  const t = await getTranslate();
  const icons = {
    paused: <PauseCircleIcon className="h-20 w-20" />,
    completed: <CheckCircle2Icon className="h-20 w-20" />,
    "link invalid": <HelpCircleIcon className="h-20 w-20" />,
    "response submitted": <CheckCircle2Icon className="h-20 w-20" />,
  };

  const descriptions = {
    paused: t("s.paused"),
    completed: t("s.completed"),
    "link invalid": t("s.link_invalid"),
    "response submitted": t("s.response_submitted"),
  };

  return (
    <div className="flex h-full flex-col items-center justify-between bg-linear-to-br from-slate-200 to-slate-50 px-4 py-8 text-center">
      <div></div>
      <div className="flex flex-col items-center space-y-3 text-slate-300">
        {icons[status]}
        <h1 className="text-4xl font-bold text-slate-800">
          {status === "completed" && surveyClosedMessage
            ? surveyClosedMessage.heading
            : `${t("common.survey")} ${status}.`}
        </h1>
        <p className="text-lg leading-10 text-slate-500">
          {status === "completed" && surveyClosedMessage
            ? surveyClosedMessage.subheading
            : descriptions[status]}
        </p>
        {!(status === "completed" && surveyClosedMessage) &&
          status !== "link invalid" &&
          status !== "response submitted" && (
            <Button className="mt-2" asChild>
              <Link href="https://formbricks.com">{t("s.create_your_own")}</Link>
            </Button>
          )}
      </div>
      <div>
        <Link href="https://formbricks.com">
          <Image src={footerLogo as string} alt="Brand logo" className="mx-auto w-40" />
        </Link>
      </div>
    </div>
  );
};
