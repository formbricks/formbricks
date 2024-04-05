import { Code, Link2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { convertDateString, timeSince } from "@formbricks/lib/time";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys";

import { SurveyStatusIndicator } from "../../SurveyStatusIndicator";
import { generateSingleUseIdAction } from "../actions";
import SurveyDropDownMenu from "./SurveyDropdownMenu";

interface SurveyCardProps {
  survey: TSurvey;
  environment: TEnvironment;
  otherEnvironment: TEnvironment;
  isViewer: boolean;
  WEBAPP_URL: string;
  orientation: string;
  duplicateSurvey: (survey: TSurvey) => void;
  deleteSurvey: (surveyId: string) => void;
}
export default function SurveyCard({
  survey,
  environment,
  otherEnvironment,
  isViewer,
  WEBAPP_URL,
  orientation,
  deleteSurvey,
  duplicateSurvey,
}: SurveyCardProps) {
  const isSurveyCreationDeletionDisabled = isViewer;

  const surveyStatusLabel = useMemo(() => {
    if (survey.status === "inProgress") return "Active";
    else if (survey.status === "completed") return "Completed";
    else if (survey.status === "draft") return "Draft";
    else if (survey.status === "paused") return "Paused";
  }, [survey]);

  const [singleUseId, setSingleUseId] = useState<string | undefined>();

  useEffect(() => {
    if (survey.singleUse?.enabled) {
      generateSingleUseIdAction(survey.id, survey.singleUse?.isEncrypted ? true : false).then(setSingleUseId);
    } else {
      setSingleUseId(undefined);
    }
  }, [survey]);

  const linkHref = useMemo(() => {
    return survey.status === "draft"
      ? `/environments/${environment.id}/surveys/${survey.id}/edit`
      : `/environments/${environment.id}/surveys/${survey.id}/summary`;
  }, [survey.status, survey.id, environment.id]);

  const SurveyTypeIndicator = ({ type }: { type: string }) => (
    <div className="flex items-center space-x-2 text-sm text-slate-600">
      {type === "web" ? (
        <>
          <Code className="h-4 w-4" />
          <span> In-app</span>
        </>
      ) : (
        <>
          <Link2Icon className="h-4 w-4" />
          <span> Link</span>
        </>
      )}
    </div>
  );

  const renderGridContent = () => {
    return (
      <Link
        href={linkHref}
        key={survey.id}
        className="relative col-span-2 flex h-44 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all ease-in-out hover:scale-105 ">
        <div className="flex justify-between">
          <SurveyTypeIndicator type={survey.type} />
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
        <div>
          <div className="text-md font-medium text-slate-900">{survey.name}</div>
          <div
            className={cn(
              "mt-3 flex w-fit items-center gap-2 rounded-full py-1 pl-1 pr-2 text-xs text-slate-800",
              surveyStatusLabel === "Active" && "bg-emerald-50",
              surveyStatusLabel === "Completed" && "bg-slate-200",
              surveyStatusLabel === "Draft" && "bg-slate-100",
              surveyStatusLabel === "Paused" && "bg-slate-100"
            )}>
            <SurveyStatusIndicator status={survey.status} /> {surveyStatusLabel}
          </div>
        </div>
      </Link>
    );
  };

  const renderListContent = () => {
    return (
      <Link
        href={linkHref}
        key={survey.id}
        className="relative grid w-full grid-cols-8 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4
    shadow-sm transition-all ease-in-out hover:scale-[101%]">
        <div className="col-span-2 flex items-center justify-self-start overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-slate-900">
          {survey.name}
        </div>
        <div
          className={cn(
            "flex w-fit items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm text-slate-800",
            surveyStatusLabel === "Active" && "bg-emerald-50",
            surveyStatusLabel === "Completed" && "bg-slate-200",
            surveyStatusLabel === "Draft" && "bg-slate-100",
            surveyStatusLabel === "Paused" && "bg-slate-100"
          )}>
          <SurveyStatusIndicator status={survey.status} /> {surveyStatusLabel}{" "}
        </div>
        <div className="flex justify-between">
          <SurveyTypeIndicator type={survey.type} />
        </div>

        <div className="col-span-4 grid w-full grid-cols-5 place-items-center">
          <div className="col-span-2 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
            {convertDateString(survey.createdAt.toString())}
          </div>
          <div className="col-span-2 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
            {timeSince(survey.updatedAt.toString())}
          </div>
          <div className="place-self-end">
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
        </div>
      </Link>
    );
  };
  if (orientation === "grid") return renderGridContent();
  else return renderListContent();
}
