"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useResponses } from "@/lib/responses/responses";

export default function SummaryMetadata({ surveyId, environmentId }) {
  const { responses, isLoadingResponses, isErrorResponses } = useResponses(environmentId, surveyId);

  if (isLoadingResponses) {
    return <LoadingSpinner />;
  }

  if (isErrorResponses) {
    return <p>Error loading Surveys</p>;
  }

  console.log(responses);

  return (
    <div className="mb-4 grid grid-cols-3 gap-x-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Total Responses</p>
        <p className="text-2xl font-bold text-slate-800">{responses.length}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Response Rate</p>
        <p className="text-2xl font-bold text-slate-800">43.4%</p>
      </div>
    </div>
  );
}
