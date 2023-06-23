import { truncate } from "@/lib/utils";
import { timeSince } from "@formbricks/lib/time";
import { OpenTextQuestion } from "@formbricks/types/questions";
import type { QuestionSummary } from "@formbricks/types/responses";
import { PersonAvatar } from "@formbricks/ui";
import { InboxStackIcon } from "@heroicons/react/24/solid";
import Link from "next/link";

interface OpenTextSummaryProps {
  questionSummary: QuestionSummary<OpenTextQuestion>;
  environmentId: string;
}

function findEmail(person) {
  const emailAttribute = person.attributes.email;
  return emailAttribute ? emailAttribute.value : null;
}

export default function OpenTextSummary({ questionSummary, environmentId }: OpenTextSummaryProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-6 pb-5 pt-6">
        <div>
          <h3 className="pb-1 text-xl font-semibold text-slate-900">{questionSummary.question.headline}</h3>
        </div>
        <div className="flex space-x-2 font-semibold text-slate-600">
          <div className="rounded-lg bg-slate-100 p-2 text-sm">Open Text Question</div>
          <div className=" flex items-center rounded-lg bg-slate-100 p-2 text-sm">
            <InboxStackIcon className="mr-2 h-4 w-4" />
            {questionSummary.responses.length} Responses
          </div>
        </div>
      </div>
      <div className="rounded-b-lg bg-white ">
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-6">User</div>
          <div className="col-span-2 pl-6">Response</div>
          <div className="px-6">Time</div>
        </div>
        {questionSummary.responses.map((response) => {
          const email = response.person && findEmail(response.person);
          const displayIdentifier = email || (response.person && truncate(response.person.id, 16)) || null;
          return (
            <div
              key={response.id}
              className="grid  grid-cols-4 items-center border-b border-slate-100 py-2 text-slate-800">
              <div className="pl-6">
                {response.person ? (
                  <Link
                    className="ph-no-capture group flex items-center"
                    href={`/environments/${environmentId}/people/${response.person.id}`}>
                    <PersonAvatar personId={response.person.id} />

                    <p className="ph-no-capture ml-2 text-slate-600 group-hover:underline">
                      {displayIdentifier}
                    </p>
                  </Link>
                ) : (
                  <div className="group flex items-center">
                    <PersonAvatar personId="anonymous" />
                    <p className="ml-2 text-slate-600">Anonymous</p>
                  </div>
                )}
              </div>
              <div className="ph-no-capture col-span-2 whitespace-pre-wrap pl-6 font-semibold">
                {response.value}
              </div>
              <div className="px-6 text-slate-500">{timeSince(response.updatedAt.toISOString())}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
