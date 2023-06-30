import LinkSurveyShareButton from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/LinkModalButton";
import StatusDropdown from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/StatusDropdown";
import SuccessMessage from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/SuccessMessage";
import { IS_FORMBRICKS_CLOUD, RESPONSES_LIMIT_FREE } from "@formbricks/lib/constants";
import { getSurveyResponses } from "@formbricks/lib/services/response";
import { getSurvey } from "@formbricks/lib/services/survey";
import { timeSinceConditionally } from "@formbricks/lib/time";
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui";
import { PencilSquareIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import { Session } from "next-auth";

interface SummaryMetadataProps {
  session: Session;
  surveyId: string;
  environmentId: string;
}

export default async function SummaryMetadata({ session, surveyId, environmentId }: SummaryMetadataProps) {
  const survey = await getSurvey(surveyId);
  if (!survey) throw new Error(`Survey not found: ${surveyId}`);
  const allResponses = await getSurveyResponses(surveyId);
  const limitReached =
    IS_FORMBRICKS_CLOUD && session?.user.plan === "free" && allResponses.length >= RESPONSES_LIMIT_FREE;
  const responses = limitReached ? allResponses.slice(0, RESPONSES_LIMIT_FREE) : allResponses;

  const completionRate = !responses
    ? 0
    : (responses.filter((r) => r.finished).length / responses.length) * 100;

  return (
    <>
      <div className="mb-4 ">
        <div className="flex flex-col-reverse gap-y-2 lg:grid lg:grid-cols-2 lg:gap-x-2">
          <div className="grid grid-cols-2 gap-4 md:grid md:grid-cols-4 md:gap-x-2">
            <div className="flex flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">Survey displays</p>
              <p className="text-2xl font-bold text-slate-800">
                {survey.analytics.numDisplays === 0 ? <span>-</span> : survey.analytics.numDisplays}
              </p>
            </div>
            <div className="flex flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-600">Total Responses</p>
              <p className="text-2xl font-bold text-slate-800">
                {responses.length === 0 ? <span>-</span> : responses.length}
              </p>
            </div>
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex h-full cursor-default flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
                    <p className="text-sm text-slate-600">
                      Response %
                      <QuestionMarkCircleIcon className="mb-1 ml-2 inline h-4 w-4 text-slate-500" />
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      {survey.analytics.responseRate === null || survey.analytics.responseRate === 0 ? (
                        <span>-</span>
                      ) : (
                        <span>{Math.round(survey.analytics.responseRate * 100)} %</span>
                      )}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>% of people who responded when survey was shown.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex cursor-default flex-col justify-between space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
                    <p className="text-sm text-slate-600">
                      Completion %
                      <QuestionMarkCircleIcon className="mb-1 ml-2 inline h-4 w-4 text-slate-500" />
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      {responses.length === 0 ? (
                        <span>-</span>
                      ) : (
                        <span>{parseFloat(completionRate.toFixed(2))} %</span>
                      )}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    % of people who started <strong>and</strong> completed the survey.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex flex-col justify-between lg:col-span-1">
            <div className="text-right text-xs text-slate-400">
              Last updated: {timeSinceConditionally(survey.updatedAt.toISOString())}
            </div>
            <div className="flex justify-end gap-x-1.5">
              {survey.type === "link" && <LinkSurveyShareButton survey={survey} />}

              <StatusDropdown survey={survey} environmentId={environmentId} />
              <Button
                variant="darkCTA"
                className="h-full w-full px-3 lg:px-6"
                href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
                <PencilSquareIcon className="mr-2 h-5  w-5 text-white" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      </div>
      <SuccessMessage environmentId={environmentId} survey={survey} />
    </>
  );
}
