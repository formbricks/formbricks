"use client";

import ResponseFeed from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/[personId]/components/ResponsesFeed";
import { ArrowDownUpIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";

export default function ResponseTimeline({
  surveys,
  user,
  environment,
  responses,
  environmentTags,
}: {
  surveys: TSurvey[];
  user: TUser;
  responses: TResponse[];
  environment: TEnvironment;
  environmentTags: TTag[];
}) {
  const [sortedResponses, setSortedResponses] = useState(responses);
  const toggleSortResponses = () => {
    setSortedResponses([...sortedResponses].reverse());
  };

  useEffect(() => {
    setSortedResponses(responses);
  }, [responses]);

  return (
    <div className="md:col-span-2">
      <div className="flex items-center justify-between pb-6">
        <h2 className="text-lg font-bold text-slate-700">Responses</h2>
        <div className="text-right">
          <button
            type="button"
            onClick={toggleSortResponses}
            className="hover:text-brand-dark flex items-center px-1 text-slate-800">
            <ArrowDownUpIcon className="inline h-4 w-4" />
          </button>
        </div>
      </div>
      <ResponseFeed
        responses={sortedResponses}
        environment={environment}
        surveys={surveys}
        user={user}
        environmentTags={environmentTags}
      />
    </div>
  );
}
