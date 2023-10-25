import Headline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/Headline";
import { getPersonIdentifier } from "@formbricks/lib/person/util";
import { timeSince } from "@formbricks/lib/time";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { PersonAvatar } from "@formbricks/ui/Avatars";
import { ChatBubbleBottomCenterTextIcon, InboxStackIcon } from "@heroicons/react/24/solid";
import { Link } from "lucide-react";
import { FC, useMemo } from "react";

interface HiddenFieldsSummaryProps {
  question: string;
  survey: TSurvey;
  responses: TResponse[];
}

const HiddenFieldsSummary: FC<HiddenFieldsSummaryProps> = ({ responses, survey, question }) => {
  const hiddenFieldResponses = useMemo(
    () =>
      survey.hiddenFields?.fieldIds?.map((question) => {
        const questionResponses = responses
          .filter((response) => question in response.data)
          .map((r) => ({
            id: r.id,
            value: r.data[question],
            updatedAt: r.updatedAt,
            person: r.person,
          }));
        return {
          question,
          responses: questionResponses,
        };
      }),
    [responses, survey.hiddenFields?.fieldIds]
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <Headline headline={question} />

        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className="flex items-center rounded-lg bg-slate-100 p-2 ">
            <ChatBubbleBottomCenterTextIcon className="mr-2 h-4 w-4" />
            Hidden Field
          </div>
          <div className="flex items-center rounded-lg bg-slate-100 p-2 ">
            <InboxStackIcon className="mr-2 h-4 w-4" />
            {hiddenFieldResponses?.find((q) => q.question === question)?.responses?.length} Responses
          </div>
        </div>
      </div>
      <div className="rounded-b-lg bg-white">
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-4 md:pl-6">User</div>
          <div className="col-span-2 pl-4 md:pl-6">Response</div>
          <div className="px-4 md:px-6">Time</div>
        </div>
        {hiddenFieldResponses
          ?.find((q) => q.question === question)
          ?.responses.map((response) => {
            // const displayIdentifier = getPersonIdentifier(response.person!);
            return (
              <div
                key={response.id}
                className="grid  grid-cols-4 items-center border-b border-slate-100 py-2 text-sm text-slate-800 md:text-base">
                <div className="pl-4 md:pl-6">
                  {/* {response.person ? (
                    <Link
                      className="ph-no-capture group flex items-center"
                      href={`/environments/${environment.id}/people/${response.person.id}`}>
                      <div className="hidden md:flex">
                        <PersonAvatar personId={response.person.id} />
                      </div>
                      <p className="ph-no-capture break-all text-slate-600 group-hover:underline md:ml-2">
                        {displayIdentifier}
                      </p>
                    </Link>
                  ) : (
                    <div className="group flex items-center">
                      <div className="hidden md:flex">
                        <PersonAvatar personId="anonymous" />
                      </div>
                      <p className="break-all text-slate-600 md:ml-2">Anonymous</p>
                    </div>
                  )} */}
                </div>
                <div className="ph-no-capture col-span-2 whitespace-pre-wrap pl-6 font-semibold">
                  {response.value}
                </div>
                <div className="px-4 text-slate-500 md:px-6">
                  {timeSince(response.updatedAt.toISOString())}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default HiddenFieldsSummary;
