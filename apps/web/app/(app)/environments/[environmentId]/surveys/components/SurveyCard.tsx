"use client";

import { generateSingleUseIdAction } from "@/app/(app)/environments/[environmentId]/surveys/actions";
import { SurveyTypeIndicator } from "@/app/(app)/environments/[environmentId]/surveys/components/SurveyTypeIndicator";
import { TSurvey } from "@/app/(app)/environments/[environmentId]/surveys/types/surveys";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { cn } from "@formbricks/lib/cn";
import { convertDateString, timeSince } from "@formbricks/lib/time";
import { TEnvironment } from "@formbricks/types/environment";
import { TUserLocale } from "@formbricks/types/user";
import { SurveyStatusIndicator } from "@formbricks/ui/components/SurveyStatusIndicator";
import { SurveyDropDownMenu } from "./SurveyDropdownMenu";

interface SurveyCardProps {
  survey: TSurvey;
  environment: TEnvironment;
  otherEnvironment: TEnvironment;
  isViewer: boolean;
  WEBAPP_URL: string;
  duplicateSurvey: (survey: TSurvey) => void;
  deleteSurvey: (surveyId: string) => void;
  locale: TUserLocale;
}
export const SurveyCard = ({
  survey,
  environment,
  otherEnvironment,
  isViewer,
  WEBAPP_URL,
  deleteSurvey,
  duplicateSurvey,
  locale,
}: SurveyCardProps) => {
  const isSurveyCreationDeletionDisabled = isViewer;
  const t = useTranslations();
  const surveyStatusLabel = useMemo(() => {
    if (survey.status === "inProgress") return t("common.in_progress");
    else if (survey.status === "scheduled") return t("common.scheduled");
    else if (survey.status === "completed") return t("common.completed");
    else if (survey.status === "draft") return t("common.draft");
    else if (survey.status === "paused") return t("common.paused");
  }, [survey]);

  const [singleUseId, setSingleUseId] = useState<string | undefined>();

  useEffect(() => {
    const fetchSingleUseId = async () => {
      if (survey.singleUse?.enabled) {
        const generateSingleUseIdResponse = await generateSingleUseIdAction({
          surveyId: survey.id,
          isEncrypted: !!survey.singleUse?.isEncrypted,
        });
        if (generateSingleUseIdResponse?.data) {
          setSingleUseId(generateSingleUseIdResponse.data);
        } else {
          const errorMessage = getFormattedErrorMessage(generateSingleUseIdResponse);
          toast.error(errorMessage);
        }
      } else {
        setSingleUseId(undefined);
      }
    };

    fetchSingleUseId();
  }, [survey]);

  const linkHref = useMemo(() => {
    return survey.status === "draft"
      ? `/environments/${environment.id}/surveys/${survey.id}/edit`
      : `/environments/${environment.id}/surveys/${survey.id}/summary`;
  }, [survey.status, survey.id, environment.id]);

  return (
    <Link href={linkHref} key={survey.id} className="relative block">
      <div className="grid w-full grid-cols-8 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8 shadow-sm transition-colors ease-in-out hover:border-slate-400">
        <div className="col-span-2 flex max-w-full items-center justify-self-start text-sm font-medium text-slate-900">
          <div className="w-full truncate">{survey.name}</div>
        </div>
        <div
          className={cn(
            "col-span-1 flex w-fit items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-2 text-sm text-slate-800",
            surveyStatusLabel === "Scheduled" && "bg-slate-200",
            surveyStatusLabel === "In Progress" && "bg-emerald-50",
            surveyStatusLabel === "Completed" && "bg-slate-200",
            surveyStatusLabel === "Draft" && "bg-slate-100",
            surveyStatusLabel === "Paused" && "bg-slate-100"
          )}>
          <SurveyStatusIndicator status={survey.status} /> {surveyStatusLabel}{" "}
        </div>
        <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
          {survey.responseCount}
        </div>
        <div className="col-span-1 flex justify-between">
          <SurveyTypeIndicator type={survey.type} />
        </div>

        <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
          {convertDateString(survey.createdAt.toString())}
        </div>
        <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
          {timeSince(survey.updatedAt.toString(), locale)}
        </div>
        <div className="col-span-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
          {survey.creator ? survey.creator.name : "-"}
        </div>
      </div>
      <div className="absolute right-3 top-3.5">
        <SurveyDropDownMenu
          survey={survey}
          key={`surveys-${survey.id}`}
          environmentId={environment.id}
          environment={environment}
          otherEnvironment={otherEnvironment!}
          webAppUrl={WEBAPP_URL}
          singleUseId={singleUseId}
          isSurveyCreationDeletionDisabled={isSurveyCreationDeletionDisabled}
          duplicateSurvey={duplicateSurvey}
          deleteSurvey={deleteSurvey}
        />
      </div>
    </Link>
  );
};
