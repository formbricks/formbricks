import { InboxIcon, Link, MessageSquareTextIcon } from "lucide-react";
import { useState } from "react";
import { getPersonIdentifier } from "@formbricks/lib/person/utils";
import { timeSince } from "@formbricks/lib/time";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurveyQuestionSummaryHiddenFields } from "@formbricks/types/surveys/types";
import { PersonAvatar } from "@formbricks/ui/components/Avatars";
import { Button } from "@formbricks/ui/components/Button";

interface HiddenFieldsSummaryProps {
  environment: TEnvironment;
  questionSummary: TSurveyQuestionSummaryHiddenFields;
}

export const HiddenFieldsSummary = ({ environment, questionSummary }: HiddenFieldsSummaryProps) => {
  const [visibleResponses, setVisibleResponses] = useState(10);

  const handleLoadMore = () => {
    // Increase the number of visible responses by 10, not exceeding the total number of responses
    setVisibleResponses((prevVisibleResponses) =>
      Math.min(prevVisibleResponses + 10, questionSummary.samples.length)
    );
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <div className={"align-center flex justify-between gap-4"}>
          <h3 className="pb-1 text-lg font-semibold text-slate-900 md:text-xl">{questionSummary.id}</h3>
        </div>

        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <MessageSquareTextIcon className="mr-2 h-4 w-4" />
            Hidden Field
          </div>
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <InboxIcon className="mr-2 h-4 w-4" />
            {questionSummary.responseCount} {questionSummary.responseCount === 1 ? "Response" : "Responses"}
          </div>
        </div>
      </div>
      <div className="rounded-b-lg bg-white">
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-4 md:pl-6">User</div>
          <div className="col-span-2 pl-4 md:pl-6">Response</div>
          <div className="px-4 md:px-6">Time</div>
        </div>
        {questionSummary.samples.slice(0, visibleResponses).map((response) => (
          <div
            key={response.value}
            className="grid grid-cols-4 items-center border-b border-slate-100 py-2 text-sm text-slate-800 md:text-base">
            <div className="pl-4 md:pl-6">
              {response.person ? (
                <Link
                  className="ph-no-capture group flex items-center"
                  href={`/environments/${environment.id}/people/${response.person.id}`}>
                  <div className="hidden md:flex">
                    <PersonAvatar personId={response.person.id} />
                  </div>
                  <p className="ph-no-capture break-all text-slate-600 group-hover:underline md:ml-2">
                    {getPersonIdentifier(response.person, response.personAttributes)}
                  </p>
                </Link>
              ) : (
                <div className="group flex items-center">
                  <div className="hidden md:flex">
                    <PersonAvatar personId="anonymous" />
                  </div>
                  <p className="break-all text-slate-600 md:ml-2">Anonymous</p>
                </div>
              )}
            </div>
            <div className="ph-no-capture col-span-2 whitespace-pre-wrap pl-6 font-semibold">
              {response.value}
            </div>
            <div className="px-4 text-slate-500 md:px-6">
              {timeSince(new Date(response.updatedAt).toISOString())}
            </div>
          </div>
        ))}
        {visibleResponses < questionSummary.samples.length && (
          <div className="flex justify-center py-4">
            <Button onClick={handleLoadMore} variant="secondary" size="sm">
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
