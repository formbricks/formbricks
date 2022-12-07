"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { useTeam } from "@/lib/teams";
import { ExclamationTriangleIcon, InformationCircleIcon } from "@heroicons/react/20/solid";
import Link from "next/link";
import { Bar, Table } from "@formbricks/charts";
import { useSubmissions } from "@/lib/submissions";
import AnalyticsCard from "@/components/AnalyticsCard";
import { useRouter } from "next/router";

export default function SummaryPage() {
  const router = useRouter();
  const { form, isLoadingForm, isErrorForm } = useForm(
    router.query.formId?.toString(),
    router.query.teamId?.toString()
  );
  const { team, isLoadingTeam, isErrorTeam } = useTeam(router.query.teamId?.toString());
  const { submissions, isLoadingSubmissions, mutateSubmissions } = useSubmissions(
    router.query.teamId?.toString(),
    router.query.formId?.toString()
  );

  if (isLoadingForm || isLoadingTeam || isLoadingSubmissions) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorForm || isErrorTeam) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  return (
    <div className="mx-auto py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
          Summary - {form.label}
          <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
            {team.name}
          </span>
        </h1>
      </header>
      <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        <AnalyticsCard value={submissions.length} label={"Total submissions"} toolTipText={""} />
      </div>
      <div className="relative my-10">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-lg font-medium text-gray-900">Questions &amp; Answers</span>
        </div>
      </div>
      {Object.keys(form.schema).length === 0 ? (
        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">This form doesn&apos;t have a schema </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Formbricks HQ needs a schema of your form to display a summary. Learn more about the schema
                  and how you can add one in our docs.
                </p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <Link
                    target="_blank"
                    href="https://formbricks.com/docs"
                    className="rounded-md bg-yellow-50 px-2 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 focus:ring-offset-yellow-50">
                    View docs
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 divide-y">
          {form.schema.children
            .filter((e) => e.type !== "submit")
            .map((elem) => (
              <div className="py-12">
                {["email", "number", "phone", "search", "text", "textarea", "url"].includes(elem.type) ? (
                  <div>
                    <h2 className="mb-6 text-xl font-bold leading-tight tracking-tight text-gray-900">
                      {elem.label}
                      <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
                        Checkbox
                      </span>
                    </h2>
                    <Table submissions={submissions} schema={form.schema} fieldName={elem.name} />
                  </div>
                ) : ["checkbox", "radio"].includes(elem.type) ? (
                  <div>
                    <h2 className="mb-6 text-xl font-bold leading-tight tracking-tight text-gray-900">
                      {elem.label}
                      <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
                        {elem.type}
                      </span>
                    </h2>
                    <Bar submissions={submissions} schema={form.schema} fieldName={elem.name} />
                  </div>
                ) : null}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
