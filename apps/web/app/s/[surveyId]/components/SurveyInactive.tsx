import { Button } from "@/modules/ui/components/button";
import { CheckCircle2Icon, HelpCircleIcon, PauseCircleIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { TSurveyClosedMessage } from "@formbricks/types/surveys/types";

export const SurveyInactive = async ({
  status,
  surveyClosedMessage,
}: {
  status: "paused" | "completed" | "link invalid" | "scheduled";
  surveyClosedMessage?: TSurveyClosedMessage | null;
}) => {
  const t = await getTranslations();
  const icons = {
    paused: <PauseCircleIcon className="h-20 w-20" />,
    completed: <CheckCircle2Icon className="h-20 w-20" />,
    "link invalid": <HelpCircleIcon className="h-20 w-20" />,
  };

  const descriptions = {
    paused: t("s.paused"),
    completed: t("s.completed"),
    "link invalid": t("s.link_invalid"),
  };

  return (
    <div className="flex h-full flex-col items-center justify-between bg-gradient-to-br from-slate-200 to-slate-50 py-8 text-center">
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
        {!(status === "completed" && surveyClosedMessage) && status !== "link invalid" && (
          <Button className="mt-2" href="https://member.digiopinion.com/overview">
            {t("s.take_more_surveys")}
          </Button>
        )}
      </div>
      <div>
        <Link href="https://digiopinion.com"></Link>
      </div>
    </div>
  );
};
