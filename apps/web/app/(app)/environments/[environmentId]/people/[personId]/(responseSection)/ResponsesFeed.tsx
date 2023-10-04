import { formatDistance } from "date-fns";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import SurveyStatusIndicator from "@/components/shared/SurveyStatusIndicator";
import { TResponseWithSurvey } from "@formbricks/types/v1/responses";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui";
import { TEnvironment } from "@formbricks/types/v1/environment";

export default function ResponseFeed({
  responses,
  sortByDate,
  environment,
}: {
  responses: TResponseWithSurvey[];
  sortByDate: boolean;
  environment: TEnvironment;
}) {
  return (
    <>
      {responses.length === 0 ? (
        <EmptySpaceFiller type="response" environment={environment} />
      ) : (
        <div>
          {responses
            .slice()
            .sort((a, b) =>
              sortByDate
                ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            )
            .map((response: TResponseWithSurvey, responseIdx) => (
              <li key={response.id} className="list-none">
                <div className="relative pb-8">
                  {responseIdx !== responses.length - 1 ? (
                    <span
                      className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200"
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="relative flex space-x-3">
                    <div className="w-full overflow-hidden rounded-lg bg-white shadow">
                      <div className="px-4 py-5 sm:p-6">
                        <div className="flex w-full justify-between">
                          <div className="text-sm text-slate-400">
                            <time
                              className="text-slate-700"
                              dateTime={formatDistance(response.createdAt, new Date(), {
                                addSuffix: true,
                              })}>
                              {formatDistance(response.createdAt, new Date(), {
                                addSuffix: true,
                              })}
                            </time>
                          </div>
                          <div className="flex items-center justify-center space-x-2  rounded-full bg-slate-50 px-3 py-1 text-sm text-slate-600">
                            <Link
                              className="hover:underline"
                              href={`/environments/${environment.id}/surveys/${response.survey.id}/summary`}>
                              {response.survey.name}
                            </Link>
                            <SurveyStatusIndicator
                              status={response.survey.status}
                              environment={environment}
                            />
                          </div>
                        </div>

                        <div className="mt-3 space-y-3">
                          {response.survey.questions.map((question) => (
                            <div key={question.id}>
                              <p className="text-sm text-slate-500">{question.headline}</p>
                              <p className="ph-no-capture my-1 text-lg font-semibold text-slate-700">
                                {Array.isArray(response.data[question.id])
                                  ? (response.data[question.id] as string[]).join(", ")
                                  : response.data[question.id]}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="flex w-full justify-end">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <p className="text-sm text-slate-500">{response.singleUseId}</p>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-sm text-slate-500">Single Use Id</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
        </div>
      )}
    </>
  );
}
