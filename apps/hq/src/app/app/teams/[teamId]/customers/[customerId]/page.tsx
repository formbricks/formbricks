"use client";

import LoadingSpinner from "@/app/LoadingSpinner";
import AnalyticsCard from "@/components/AnalyticsCard";
import { useCustomer } from "@/lib/customers";
import { useTeam } from "@/lib/teams";
import { onlyUnique } from "@/lib/utils";
import { ArrowRightIcon } from "@heroicons/react/20/solid";
import Link from "next/link";
import { useMemo } from "react";
import SubmissionDisplay from "../../forms/[formId]/submissions/SubmissionDisplay";

export default function FormsPage({ params }) {
  const { team, isLoadingTeam, isErrorTeam } = useTeam(params.teamId);
  const { customer, isLoadingCustomer, isErrorCustomer } = useCustomer(params.teamId, params.customerId);

  const formsParticipated = useMemo(() => {
    if (customer && "submissions" in customer) {
      return customer.submissions.map((s) => s.formId).filter(onlyUnique).length;
    }
  }, [customer]);

  if (isLoadingTeam || isLoadingCustomer) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorTeam || isErrorCustomer) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  return (
    <div className="mx-auto py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
          Customer - {customer.id}
          <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
            {team.name}
          </span>
        </h1>
      </header>
      <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4 2xl:grid-cols-8">
        <AnalyticsCard value={customer.submissions.length} label={"Total Submissions"} />
        <AnalyticsCard value={formsParticipated} label={"Forms Participated"} />
      </div>
      <div className="relative my-10">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gray-50 px-3 text-lg font-medium text-gray-900">Submissions</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        {customer.submissions.map((submission) => (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="px-4 py-5 sm:p-6">
              <SubmissionDisplay schema={{}} submission={submission} />
            </div>
            <div className="flex justify-end bg-gray-50 px-4 py-4 text-xs sm:px-6">
              <Link href={`/app/teams/${params.teamId}/forms/${submission.formId}`}>To Form &rarr;</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
