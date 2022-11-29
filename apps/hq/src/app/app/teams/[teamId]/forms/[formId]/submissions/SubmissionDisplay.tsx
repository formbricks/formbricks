"use client";

import LoadingSpinner from "@/app/LoadingSpinner";
import { useForm } from "@/lib/forms";
import clsx from "clsx";

export default function SubmissionDisplay({ params, submission }) {
  const { form, isLoadingForm } = useForm(params.formId, params.formId);

  if (isLoadingForm) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flow-root">
      <ul role="list" className="divide-ui-gray-light divide-y">
        {Object.entries(submission.data).map(([key, value]) => (
          <li key={key} className="py-5">
            <p className="text-sm font-semibold text-gray-800">{key}</p>

            <p
              className={clsx(
                value ? "text-gray-600" : "text-gray-400",
                "whitespace-pre-line pt-1 text-sm text-gray-600"
              )}>
              {value.toString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
