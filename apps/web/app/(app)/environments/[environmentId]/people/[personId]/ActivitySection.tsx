"use client";

import ActivityFeed from "@/app/(app)/environments/[environmentId]/people/[personId]/ActivityFeed";
import { TDisplaysWithSurveyName } from "@formbricks/types/v1/displays";
import { TPersonDetailedAttribute } from "@formbricks/types/v1/people";
import { TSessionWithActions } from "@formbricks/types/v1/sessions";
import { ArrowsUpDownIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

export default function ActivitySection({
  environmentId,
  sessionsWithActions,
  attributes,
  displays,
}: {
  environmentId: string;
  sessionsWithActions: TSessionWithActions[];
  attributes: TPersonDetailedAttribute[];
  displays: TDisplaysWithSurveyName[];
}) {
  const [activityAscending, setActivityAscending] = useState(true);
  const toggleSortActivity = () => {
    setActivityAscending(!activityAscending);
  };

  return (
    <div className="md:col-span-1">
      <div className="flex items-center justify-between pb-6">
        <h2 className="text-lg font-bold text-slate-700">Activity Timeline</h2>
        <div className="text-right">
          <button
            onClick={toggleSortActivity}
            className="hover:text-brand-dark flex items-center px-1 text-slate-800">
            <ArrowsUpDownIcon className="inline h-4 w-4" />
          </button>
        </div>
      </div>

      <ActivityFeed
        sessions={sessionsWithActions}
        attributes={attributes}
        displays={displays}
        sortByDate={activityAscending}
        environmentId={environmentId}
      />
    </div>
  );
}
