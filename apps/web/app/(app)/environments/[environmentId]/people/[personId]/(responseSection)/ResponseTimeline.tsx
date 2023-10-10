"use client";

import ResponseFeed from "@/app/(app)/environments/[environmentId]/people/[personId]/(responseSection)/ResponsesFeed";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { ArrowsUpDownIcon } from "@heroicons/react/24/outline";
import { useState, useEffect } from "react";
import { TTag } from "@formbricks/types/v1/tags";
import { TProfile } from "@formbricks/types/v1/profile";

export default function ResponseTimeline({
  surveys,
  profile,
  environment,
  responses,
  environmentTags,
}: {
  surveys: TSurvey[];
  profile: TProfile;
  responses: TResponse[];
  environment: TEnvironment;
  environmentTags: TTag[];
}) {
  const [responsesAscending, setResponsesAscending] = useState(false);
  const [sortedResponses, setSortedResponses] = useState(responses);
  const toggleSortResponses = () => {
    setResponsesAscending(!responsesAscending);
  };

  useEffect(() => {
    setSortedResponses(responsesAscending ? [...responses].reverse() : responses);
  }, [responsesAscending]);

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
      <ResponseFeed
        responses={sortedResponses}
        environment={environment}
        surveys={surveys}
        profile={profile}
        environmentTags={environmentTags}
      />
    </div>
  );
}
