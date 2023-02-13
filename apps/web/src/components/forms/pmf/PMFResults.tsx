"use client";

import EmptyPageFiller from "@/components/EmptyPageFiller";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useSubmissions } from "@/lib/submissions";
import { InboxIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { useState } from "react";
import FilterNavigation from "../shared/FilterNavigation";
import PMFTimeline from "./PMFTimeline";

export default function PMFResults() {
  const router = useRouter();
  const { submissions, isLoadingSubmissions, isErrorSubmissions } = useSubmissions(
    router.query.organisationId?.toString(),
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
  return (
    <div>
      <div>
        <section aria-labelledby="filters" className="max-w-8xl mx-auto py-8 pt-6 pb-24">
          <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-4">
            <FilterNavigation submissions={submissions} setFilteredSubmissions={setFilteredSubmissions} />

            {/* Submission grid */}

            <div className="max-w-3xl md:col-span-3">
              {submissions.length === 0 ? (
                <EmptyPageFiller
                  alertText="You haven't received any submissions yet."
                  hintText="Embed the PMF survey on your website to start gathering insights."
                  borderStyles="border-4 border-dotted border-red">
                  <InboxIcon className="stroke-thin mx-auto h-24 w-24 text-slate-300" />
                </EmptyPageFiller>
              ) : (
                <PMFTimeline submissions={filteredSubmissions} />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
