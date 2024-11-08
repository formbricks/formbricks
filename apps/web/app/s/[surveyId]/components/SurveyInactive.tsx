import { CheckCircle2Icon, HelpCircleIcon, PauseCircleIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { TSurveyClosedMessage } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";
import footerLogo from "../lib/footerlogo.svg";

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
          <Button className="mt-2" href="https://formbricks.com">
            {t("s.create_your_own")}
          </Button>
        )}
      </div>
      <div>
        <Link href="https://formbricks.com">
          <Image src={footerLogo} alt="Brand logo" className="mx-auto w-40" />
        </Link>
      </div>
    </div>
  );
};
