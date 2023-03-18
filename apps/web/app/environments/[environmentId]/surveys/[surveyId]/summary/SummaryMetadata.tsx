"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import Button from "@/components/ui/Button";
import { useResponses } from "@/lib/responses/responses";
import { useMemo } from "react";
import { PencilSquareIcon } from "@heroicons/react/24/solid";

export default function SummaryMetadata({ surveyId, environmentId }) {
  const { responses, isLoadingResponses, isErrorResponses } = useResponses(environmentId, surveyId);

  const responseRate = useMemo(() => {
    if (!responses) return 0;
    return (responses.filter((r) => r.finished).length / responses.length) * 100;
  }, [responses]);

  if (isLoadingResponses) {
    return <LoadingSpinner />;
  }

  if (isErrorResponses) {
    return <p>Error loading Surveys</p>;
  }

  return (
    <div className="mb-4 grid grid-cols-3 gap-x-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Total Responses</p>
        <p className="text-2xl font-bold text-slate-800">
          {responses.length === 0 ? <span>-</span> : responses.length}
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Response Rate</p>
        <p className="text-2xl font-bold text-slate-800">
          {responses.length === 0 ? <span>-</span> : <span>{parseFloat(responseRate.toFixed(2))} %</span>}
        </p>
      </div>
      <div className="flex flex-col justify-between">
        <div className="flex justify-end"></div>
        <div className="flex justify-end">
          <Button href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
            <PencilSquareIcon className="mr-2 h-5 w-5 text-white" /> Edit Survey
          </Button>
        </div>
      </div>
    </div>
  );
}
