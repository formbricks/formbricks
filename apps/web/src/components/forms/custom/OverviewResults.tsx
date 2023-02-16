"use client";

import EmptyPageFiller from "@/components/EmptyPageFiller";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { useSubmissions } from "@/lib/submissions";
import { capitalizeFirstLetter } from "@/lib/utils";
import { Bar, Nps, Table } from "@formbricks/charts";
import { RectangleGroupIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { useState } from "react";
import FilterNavigation from "../shared/FilterNavigation";
import { SubmissionCounter } from "../shared/SubmissionCounter";

export default function OverviewResults() {
  const router = useRouter();
  const { form, isLoadingForm, isErrorForm } = useForm(
    router.query.formId?.toString(),
    router.query.organisationId?.toString()
  );
  const { submissions, isLoadingSubmissions, isErrorSubmissions } = useSubmissions(
    router.query.organisationId?.toString(),
    router.query.formId?.toString()
  );
  const [numTotalSubmissions, setNumTotalSubmissions] = useState(0);
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);

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

  return (
    <div>
      <div>
        <section aria-labelledby="filters" className="pt-6 pb-24">
          <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-4">
            <div>
              <SubmissionCounter
                numFilteredSubmissions={filteredSubmissions.length}
                numTotalSubmissions={numTotalSubmissions}
              />
              <FilterNavigation
                submissions={submissions}
                setFilteredSubmissions={setFilteredSubmissions}
                setNumTotalSubmissions={setNumTotalSubmissions}
              />
            </div>

            {/* Submission grid */}

            <div className="max-w-7xl lg:col-span-3">
              {form && form.schema && Object.keys(form.schema).length > 0 ? (
                <>
                  <div className="4xl:grid-cols-2 grid grid-cols-1 gap-6">
                    {form.schema.pages.map((page) =>
                      page.elements
                        .filter((e) =>
                          [
                            "checkbox",
                            "email",
                            "number",
                            "nps",
                            "phone",
                            "radio",
                            "search",
                            "text",
                            "textarea",
                            "url",
                          ].includes(e.type)
                        )
                        .map((elem) => (
                          <div className="rounded-lg bg-white px-4 py-5 shadow-lg sm:p-6">
                            <h2 className="mb-6 text-lg font-bold text-slate-800">
                              {elem.label}
                              <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
                                {capitalizeFirstLetter(elem.type)}
                              </span>
                            </h2>
                            {filteredSubmissions.filter((s) => elem.name in s.data).length === 0 ? (
                              <EmptyPageFiller
                                alertText="No responses for that question yet"
                                hintText="Share your form to get more responses"
                                borderStyles="border-4 border-dotted border-red"></EmptyPageFiller>
                            ) : (
                              <>
                                {["email", "number", "phone", "search", "text", "textarea", "url"].includes(
                                  elem.type
                                ) ? (
                                  <div className="max-h-96 overflow-auto">
                                    <Table
                                      submissions={filteredSubmissions}
                                      schema={form.schema}
                                      fieldName={elem.name}
                                    />
                                  </div>
                                ) : ["checkbox", "radio"].includes(elem.type) ? (
                                  <div>
                                    <Bar
                                      submissions={filteredSubmissions}
                                      schema={form.schema}
                                      fieldName={elem.name}
                                    />
                                  </div>
                                ) : ["nps"].includes(elem.type) ? (
                                  <div>
                                    <Nps
                                      submissions={filteredSubmissions}
                                      schema={form.schema}
                                      fieldName={elem.name}
                                    />
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        ))
                    )}
                    {}
                  </div>
                </>
              ) : (
                <EmptyPageFiller
                  alertText="No schema found"
                  hintText="Please add a schema to your form to use the overview page"
                  borderStyles="border-4 border-dotted border-red">
                  <RectangleGroupIcon className="stroke-thin mx-auto h-24 w-24 text-slate-300" />
                </EmptyPageFiller>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
