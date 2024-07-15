import Link from "next/link";
import { getPersonIdentifier } from "@formbricks/lib/person/utils";
import { timeSince } from "@formbricks/lib/time";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyQuestionSummaryAddress } from "@formbricks/types/surveys/types";
import { AddressResponse } from "@formbricks/ui/AddressResponse";
import { PersonAvatar } from "@formbricks/ui/Avatars";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface AddressSummaryProps {
  questionSummary: TSurveyQuestionSummaryAddress;
  environmentId: string;
  survey: TSurvey;
  attributeClasses: TAttributeClass[];
}

export const AddressSummary = ({
  questionSummary,
  environmentId,
  survey,
  attributeClasses,
}: AddressSummaryProps) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader
        questionSummary={questionSummary}
        survey={survey}
        attributeClasses={attributeClasses}
      />
      <div className="">
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-4 md:pl-6">User</div>
          <div className="col-span-2 pl-4 md:pl-6">Response</div>
          <div className="px-4 md:px-6">Time</div>
        </div>
        <div className="max-h-[62vh] w-full overflow-y-auto">
          {questionSummary.samples.map((response) => {
            return (
              <div
                key={response.id}
                className="grid grid-cols-4 items-center border-b border-slate-100 py-2 text-sm text-slate-800 last:border-transparent md:text-base">
                <div className="pl-4 md:pl-6">
                  {response.person ? (
                    <Link
                      className="ph-no-capture group flex items-center"
                      href={`/environments/${environmentId}/people/${response.person.id}`}>
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
                {
                  <div className="ph-no-capture col-span-2 pl-6 font-semibold">
                    <AddressResponse value={response.value} />
                  </div>
                }

                <div className="px-4 text-slate-500 md:px-6">
                  {timeSince(new Date(response.updatedAt).toISOString())}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
