"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { getOptionLabelMap, useSubmissions } from "@/lib/submissions";
import { Pie } from "@formbricks/charts";
import { NotDisappointedIcon, SomewhatDisappointedIcon, VeryDisappointedIcon } from "@formbricks/ui";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import FilterNavigation from "../shared/FilterNavigation";

export default function SegmentResults() {
  const router = useRouter();
  const { form, isLoadingForm, isErrorForm } = useForm(
    router.query.formId?.toString(),
    router.query.organisationId?.toString()
  );
  const { submissions, isLoadingSubmissions, isErrorSubmissions } = useSubmissions(
    router.query.organisationId?.toString(),
    router.query.formId?.toString()
  );
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);

  const labelMap = useMemo(() => {
    if (form) {
      return getOptionLabelMap(form.schema);
    }
  }, [form]);

  if (isLoadingSubmissions || isLoadingForm) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorSubmissions || isErrorForm) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }

  const questions = [
    {
      label: "What is the main benefit you receive from our service?",
      name: "mainBenefit",
    },
    {
      label: "How can we improve our service for you?",
      name: "improvement",
    },
    {
      label: "What type of people would benefit most from using our service?",
      name: "selfSegmentation",
    },
  ];

  return (
    <div>
      <div>
        <section aria-labelledby="filters" className="pt-6 pb-24">
          <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-4">
            <FilterNavigation submissions={submissions} setFilteredSubmissions={setFilteredSubmissions} />

            {/* Submission grid */}

            <div className="max-w-7xl lg:col-span-3">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="flex flex-col items-center justify-center rounded-lg bg-white p-2">
                  <h3 className="text-sm font-medium text-slate-800">Overall</h3>
                  <h3 className="text-xs font-light text-slate-800">({submissions.length} submissions)</h3>
                  <Pie submissions={submissions} schema={form.schema} fieldName={"disappointment"} />
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg bg-white p-2">
                  <h3 className="text-sm font-medium text-slate-800">Selected Segment</h3>
                  <h3 className="text-xs font-light text-slate-800">
                    ({filteredSubmissions.length} submissions)
                  </h3>
                  <Pie submissions={filteredSubmissions} schema={form.schema} fieldName={"disappointment"} />
                </div>
              </div>
              {questions.map((question) => (
                <div key={question.name} className="my-4 rounded-lg bg-white">
                  <div className="rounded-t-lg bg-slate-100 p-4 text-lg font-bold text-slate-800">
                    {question.label}
                  </div>
                  <div className="grid grid-cols-5 gap-2 border-t border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
                    <div className="col-span-3">Response</div>
                    <div>Feeling</div>
                    <div>Segment</div>
                  </div>
                  {filteredSubmissions
                    .filter((s) => question.name in s.data)
                    .map((submission) => (
                      <div
                        key={submission.id}
                        className="grid grid-cols-5 gap-2 border-t border-slate-100 px-4 pt-2 pb-4 text-sm">
                        <div className="col-span-3">{submission.data[question.name]}</div>
                        <div>
                          {submission.data.disappointment === "veryDisappointed" ? (
                            <VeryDisappointedIcon className="h-6 w-6 text-white" aria-hidden="true" />
                          ) : submission.data.disappointment === "notDisappointed" ? (
                            <NotDisappointedIcon className="h-6 w-6 text-white" aria-hidden="true" />
                          ) : submission.data.disappointment === "somewhatDisappointed" ? (
                            <SomewhatDisappointedIcon className="h-6 w-6 text-white" aria-hidden="true" />
                          ) : null}
                        </div>
                        <div>
                          <div className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                            {labelMap[submission.data.userSegment]}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
