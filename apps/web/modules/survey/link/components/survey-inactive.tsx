import { CalendarClockIcon, CheckCircle2Icon, HelpCircleIcon, PauseCircleIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Workspace } from "@formbricks/database/prisma-browser";
import { TSurveyClosedMessage } from "@formbricks/types/surveys/types";
import { getTranslate } from "@/lingodotdev/server";
import { Button } from "@/modules/ui/components/button";
import footerLogo from "../lib/footerlogo.svg";

export const SurveyInactive = async ({
  status,
  isScheduled = false,
  surveyClosedMessage,
  workspace,
}: {
  status: "paused" | "completed" | "link invalid" | "response submitted" | "link expired";
  isScheduled?: boolean;
  surveyClosedMessage?: TSurveyClosedMessage | null;
  workspace?: Pick<Workspace, "linkSurveyBranding">;
}) => {
  const t = await getTranslate();
  const icons = {
    paused: isScheduled ? <CalendarClockIcon className="size-20" /> : <PauseCircleIcon className="size-20" />,
    completed: <CheckCircle2Icon className="size-20" />,
    "link invalid": <HelpCircleIcon className="size-20" />,
    "response submitted": <CheckCircle2Icon className="size-20" />,
    "link expired": <CalendarClockIcon className="size-20" />,
  };

  const descriptions = {
    paused: isScheduled ? t("s.scheduled") : t("s.paused"),
    completed: t("s.completed"),
    "link invalid": t("s.link_invalid"),
    "response submitted": t("s.response_submitted"),
    "link expired": t("c.link_expired_description"),
  };
  const headings = {
    paused: isScheduled ? t("common.survey_scheduled") : t("s.paused_heading"),
    completed: t("s.completed_heading"),
    "link invalid": t("s.this_looks_fishy"),
    "response submitted": t("s.survey_already_answered_heading"),
    "link expired": t("c.link_expired_heading"),
  };

  const title =
    (status === "completed" || status === "link expired") && surveyClosedMessage
      ? surveyClosedMessage.heading
      : headings[status];

  const description =
    status === "completed" && surveyClosedMessage ? surveyClosedMessage.subheading : descriptions[status];

  const showCTA =
    status !== "link invalid" &&
    status !== "link expired" &&
    status !== "response submitted" &&
    ((status !== "paused" && status !== "completed") || workspace?.linkSurveyBranding || !workspace) &&
    !(status === "completed" && surveyClosedMessage);

  return (
    <div className="flex h-full flex-col items-center justify-between bg-gradient-to-br from-slate-200 to-slate-50 px-4 py-8 text-center">
      <div className="my-auto flex flex-col items-center gap-y-3 text-slate-300">
        {icons[status]}
        <h1 className="text-4xl font-bold text-slate-800">{title}</h1>
        <p className="text-lg leading-10 text-slate-500">{description}</p>
        {showCTA && (
          <Button className="mt-2" asChild>
            <Link href="https://formbricks.com">{t("s.create_your_own")}</Link>
          </Button>
        )}
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
