"use client";

import ResponseFeed from "@/app/(app)/environments/[environmentId]/people/[personId]/(responseSection)/ResponsesFeed";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TResponseWithSurvey } from "@formbricks/types/v1/responses";
import { ArrowsUpDownIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

export default function ResponseTimeline({
  environment,
  responses,
}: {
  environment: TEnvironment;
  responses: TResponseWithSurvey[];
}) {
  const [responsesAscending, setResponsesAscending] = useState(true);
  const toggleSortResponses = () => {
    setResponsesAscending(!responsesAscending);
  };

  return (
    <div className="md:col-span-2">
      <div className="flex items-center justify-between pb-6">
        <h2 className="text-lg font-bold text-slate-700">Responses</h2>
        <div className="text-right">
          <button
            onClick={toggleSortResponses}
            className="hover:text-brand-dark flex items-center px-1 text-slate-800">
            <ArrowsUpDownIcon className="inline h-4 w-4" />
          </button>
        </div>
      </div>
      <ResponseFeed responses={responses} sortByDate={responsesAscending} environment={environment} />
    </div>
  );
}
