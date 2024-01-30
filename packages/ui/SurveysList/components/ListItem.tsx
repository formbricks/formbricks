import { Code, Link2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { timeSince } from "@formbricks/lib/time";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys";

import { generateSingleUseIdAction } from "../actions";
import SurveyDropDownMenu from "./SurveyDropdownMenu";

interface ListItemProps {
  survey: TSurvey;
  environment: TEnvironment;
  otherEnvironment: TEnvironment;
  isViewer: boolean;
  WEBAPP_URL: string;
}
export default function ListItem({
  survey,
  environment,
  otherEnvironment,
  isViewer,
  WEBAPP_URL,
}: ListItemProps) {
  const isSurveyCreationDeletionDisabled = isViewer;
  const [singleUseId, setSingleUseId] = useState<string | undefined>();

  useEffect(() => {
    if (survey.singleUse?.enabled) {
      generateSingleUseIdAction(survey.id, survey.singleUse?.isEncrypted ? true : false).then(setSingleUseId);
    } else {
      setSingleUseId(undefined);
    }
  }, [survey]);

  const surveyStatus = useMemo(() => {
    if (survey.status === "inProgress") return "Active";
    else if (survey.status === "completed") return "Completed";
    else if (survey.status === "draft") return "Draft";
    else if (survey.status === "paused") return "Paused";
  }, [survey]);

  return (
    <div
      key={survey.id}
      className="relative col-span-2 flex justify-between rounded-3xl bg-white px-4 py-4 shadow-md
      transition ease-in-out hover:scale-[102%]">
      <div className="flex w-[60%] items-center space-x-4">
        <div className="w-[40%] overflow-hidden overflow-ellipsis whitespace-nowrap text-xl font-medium">
          {survey.name}
        </div>
        <div className=" w-[10%] rounded-xl bg-teal-50 p-2 text-center text-sm">{surveyStatus}</div>

        <div className="flex justify-between">
          {survey.type === "web" ? (
            <div className="flex items-center space-x-2 text-slate-500">
              <Code className="h-4 w-4" />
              <span> In-app</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-slate-500">
              <Link2Icon className="h-4 w-4" />
              <span> Link</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex w-[40%] items-center justify-between">
        <div>{timeSince(survey.createdAt.toString())}</div>
        <div>{timeSince(survey.updatedAt.toString())}</div>
        <SurveyDropDownMenu
          survey={survey}
          key={`surveys-${survey.id}`}
          environmentId={environment.id}
          environment={environment}
          otherEnvironment={otherEnvironment!}
          webAppUrl={WEBAPP_URL}
          singleUseId={singleUseId}
          isSurveyCreationDeletionDisabled={isSurveyCreationDeletionDisabled}
        />
      </div>

      <Link
        href={
          survey.status === "draft"
            ? `/environments/${environment.id}/surveys/${survey.id}/edit`
            : `/environments/${environment.id}/surveys/${survey.id}/summary`
        }
        className="absolute h-full w-full"></Link>
    </div>
  );
}
