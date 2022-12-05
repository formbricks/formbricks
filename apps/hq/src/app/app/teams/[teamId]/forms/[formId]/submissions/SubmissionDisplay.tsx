"use client";

import LoadingSpinner from "@/app/LoadingSpinner";
import { useForm } from "@/lib/forms";
import clsx from "clsx";

export default function SubmissionDisplay({ schema, submission }) {
  const MergeWithSchema = (submissionData, schema) => {
    if (Object.keys(schema).length === 0) {
      // no schema provided
      return submissionData;
    }
    const mergedData = {};
    for (const elem of schema.children) {
      if (["submit"].includes(elem.type)) {
        continue;
      }
      if (elem.name in submissionData) {
        mergedData[elem.label] = submissionData[elem.name];
      } else {
        mergedData[elem.label] = "not provided";
      }
    }
    return mergedData;
  };

  return (
    <div className="flow-root">
      <ul role="list" className="divide-ui-gray-light divide-y">
        {Object.entries(MergeWithSchema(submission.data, schema)).map(([key, value]) => (
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
