"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { useSubmissions } from "@/lib/submissions";
import clsx from "clsx";
import { useRouter } from "next/router";
import { useState } from "react";
import FilterNavigation from "../shared/FilterNavigation";

const subCategories = [
  { name: "Somewhat disappointed", href: "#" },
  { name: "Very disappointed", href: "#" },
  { name: "Not disappointed", href: "#" },
];

export default function SegmentResults() {
  const router = useRouter();
  const { submissions, isLoadingSubmissions, isErrorSubmissions, mutateSubmissions } = useSubmissions(
    router.query.workspaceId?.toString(),
    router.query.formId?.toString()
  );
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);

  if (isLoadingSubmissions) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorSubmissions) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }

  const submissionz = [
    {
      question: "What is the main benefit you receive from our service?",
    },
    {
      question: "How can we improve our service for you?",
    },
    {
      question: "What type of people would benefit most from using our service?",
    },
  ];

  const q1responses = [
    {
      response:
        "A think it would be awesome if your app could do this because I keep having this problem! I would use it everyday and tell all my friends.",
      feeling: "very disapp.",
      segment: "Founder",
    },
    {
      response:
        "B think it would be awesome if your app could do this because I keep having this problem! I would use it everyday and tell all my friends.",
      feeling: "somewhat disapp.",
      segment: "Entrepreneur",
    },
    {
      response:
        "C think it would be awesome if your app could do this because I keep having this problem! I would use it everyday and tell all my friends.",
      feeling: "not disapp.",
      segment: "Product Manager",
    },
  ];

  return (
    <div>
      <div>
        <section aria-labelledby="filters" className="pt-6 pb-24">
          <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-4">
            <FilterNavigation submissions={submissions} setFilteredSubmissions={setFilteredSubmissions} />

            {/* Submission grid */}

            <div className="max-w-3xl lg:col-span-3">
              <div className="flex w-full space-x-3">
                <div className="flex h-12 w-1/2 items-center justify-center rounded-lg bg-white">
                  overall results
                </div>
                <div className="flex h-12 w-1/2 items-center justify-center rounded-lg bg-white">
                  segment results
                </div>
              </div>
              {submissionz.map((s) => (
                <div key={s.question} className="my-4 rounded-lg bg-white">
                  <div className="rounded-t-lg bg-slate-100 p-4 text-lg font-bold text-slate-800">
                    {" "}
                    {s.question}{" "}
                  </div>
                  <div className="grid grid-cols-5 gap-2 bg-slate-100 px-4 pb-2 text-sm font-semibold text-slate-500">
                    <div className="col-span-3">Response</div>
                    <div>Feeling</div>
                    <div>Segment</div>
                  </div>
                  {q1responses.map((r) => (
                    <div className="grid grid-cols-5 gap-2 px-4 pt-2 pb-4">
                      <div className="col-span-3">{r.response}</div>
                      <div>
                        <div
                          className={clsx(
                            // base styles independent what type of button it is
                            "inline-grid rounded-full px-2 text-xs",
                            // different styles depending on size
                            r.feeling === "very disapp." && "bg-green-100 text-green-700 ",
                            r.feeling === "somewhat disapp." && "bg-orange-100 text-orange-500 ",
                            r.feeling === "not disapp." && "bg-red-100 text-red-500"
                          )}>
                          {r.feeling}
                        </div>
                      </div>
                      <div>
                        <div className="inline-grid rounded-full bg-slate-100 px-2 text-xs text-slate-600">
                          {r.segment}
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
