"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import PMFThumb2 from "@/images/pmfthumb-2.webp";
import PMFThumb from "@/images/pmfthumb.webp";
import { useSubmissions } from "@/lib/submissions";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import FilterNavigation from "../shared/FilterNavigation";

export default function SegmentResults() {
  const router = useRouter();
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);
  const { submissions, isLoadingSubmissions, isErrorSubmissions } = useSubmissions(
    router.query.workspaceId?.toString(),
    router.query.formId?.toString()
  );

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
      feeling: "very disapp.",
      segment: "Entrepreneur",
    },
    {
      response:
        "C think it would be awesome if your app could do this because I keep having this problem! I would use it everyday and tell all my friends.",
      feeling: "very disapp.",
      segment: "Product Manager",
    },
  ];

  if (isLoadingSubmissions) return <LoadingSpinner />;

  if (isErrorSubmissions)
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;

  return (
    <div>
      <div>
        <section aria-labelledby="filters" className="pt-6 pb-24">
          <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-4">
            <div>
              {/* Segments */}

              <FilterNavigation submissions={submissions} setFilteredSubmissions={setFilteredSubmissions} />
              <div className="mb-2 flex py-2 text-sm font-bold">
                <h4 className="text-slate-600">Tutorials</h4>
              </div>
              <Link
                href="https://review.firstround.com/how-superhuman-built-an-engine-to-find-product-market-fit"
                target={"_blank"}>
                <div className="mb-4 rounded-md bg-white shadow-sm transition-all duration-100 ease-in-out hover:scale-105">
                  <Image src={PMFThumb} className="rounded-t-md" alt={"PMF Article Thumb 1"} />

                  <div className="p-4">
                    <p className="font-bold text-slate-600">
                      Superhuman built an engine to find Product-Market Fit
                    </p>
                    <p className="text-brand-dark text-sm">firstround.com</p>
                  </div>
                </div>
              </Link>

              <Link href="https://coda.io/@rahulvohra/superhuman-product-market-fit-engine" target={"_blank"}>
                <div className="mb-4 rounded-md bg-white shadow-sm transition-all duration-100 ease-in-out hover:scale-105">
                  <Image src={PMFThumb2} className="rounded-t-md" alt={"PMF Article Thumb 2"} />
                  <div className="p-4">
                    <p className="font-bold text-slate-600">The Superhuman Product/Market Fit Engine</p>
                    <p className="text-brand-dark text-sm">coda.io</p>
                  </div>
                </div>
              </Link>
            </div>

            {/* Double down on what they love*/}

            <div className="max-w-3xl lg:col-span-3">
              <div className="flex w-full space-x-3">
                <div className="flex h-12 w-1/2 items-center justify-center rounded-lg bg-white">
                  overall results
                </div>
                <div className="flex h-12 w-1/2 items-center justify-center rounded-lg bg-white">
                  max. very d. segment
                </div>
              </div>
              <h2 className="mt-10 mb-4 text-2xl font-bold text-slate-500">Double down on what they love</h2>
              <div className="my-4 rounded-lg bg-white">
                <div className="rounded-t-lg bg-slate-100 p-4 text-lg font-bold text-slate-800">
                  What is the main benefit you receive from our service?
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
              <h2 className="mt-10 mb-4 text-2xl font-bold text-slate-500">Fix what’s holding them back</h2>
              <div className="my-4 rounded-lg bg-white">
                <div className="rounded-t-lg bg-slate-100 p-4 text-lg font-bold text-slate-800">
                  How can we improve our service for you?
                </div>
                <div className="grid grid-cols-5 gap-2 bg-slate-100 px-4 pb-2 text-sm font-semibold text-slate-500">
                  <div className="col-span-3">Response</div>
                  <div>Feeling</div>
                  <div>Segment</div>
                </div>
                {filteredSubmissions.map((r) => (
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
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
