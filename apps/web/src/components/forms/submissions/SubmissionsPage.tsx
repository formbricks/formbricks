"use client";

import SubmissionDisplay from "@/components/forms/submissions/SubmissionDisplay";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { deleteSubmission, useSubmissions } from "@/lib/submissions";
import { convertDateTimeString } from "@/lib/utils";
import { RadioGroup } from "@headlessui/react";
import { TrashIcon } from "@heroicons/react/24/outline";
import type { Submission } from "@prisma/client";
import clsx from "clsx";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export default function SubmissionsPage() {
  const router = useRouter();
  const { submissions, isLoadingSubmissions, mutateSubmissions, isErrorSubmissions } = useSubmissions(
    router.query.workspaceId?.toString(),
    router.query.formId?.toString()
  );
  const { form, isLoadingForm, isErrorForm } = useForm(
    router.query.formId?.toString(),
    router.query.workspaceId?.toString()
  );
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);

  const handleDelete = async (submission: Submission) => {
    try {
      await deleteSubmission(
        router.query.workspaceId?.toString(),
        router.query.formId?.toString(),
        submission.id
      );

      await mutateSubmissions();
      setActiveSubmission(null);
      toast("Successfully deleted");
    } catch (error) {
      toast(error);
    }
  };

  useEffect(() => {
    if (!isLoadingSubmissions && submissions.length > 0) {
      setActiveSubmission(submissions[0]);
    }
  }, [isLoadingSubmissions, submissions]);

  if (isLoadingSubmissions || isLoadingForm) {
    return <LoadingSpinner />;
  }

  if (isErrorForm || isErrorSubmissions) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }

  return (
    <div className="max-w-screen mx-auto flex h-full w-full flex-1 flex-col overflow-visible">
      <div className="relative z-0 flex h-full flex-1 overflow-visible">
        <main className="relative z-0 mb-32 flex-1 overflow-y-auto focus:outline-none xl:order-last">
          <div className="overflow-visible sm:rounded-lg">
            {!activeSubmission ? (
              <button
                type="button"
                className="relative mx-auto mt-8 block w-96 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                <span className="mt-2 block text-sm font-medium text-gray-500">
                  Select a response on the left to see the details here
                </span>
              </button>
            ) : (
              <>
                <div className="bg-white px-4 py-5 shadow sm:px-12 sm:pb-4 sm:pt-12">
                  <div className="grid grid-cols-2 gap-8 divide-x">
                    <div className="flow-root">
                      <h1 className="mb-8 text-gray-700">
                        {convertDateTimeString(activeSubmission.createdAt.toString())}
                      </h1>
                      <SubmissionDisplay submission={activeSubmission} schema={form.schema} />
                    </div>
                  </div>
                </div>
                <div className="w-full">
                  <button
                    className="flex w-full items-center justify-center gap-2 border border-transparent bg-gray-300 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-500 focus:outline-none"
                    onClick={() => {
                      if (
                        confirm("Are you sure you want to delete this submission? It will be gone forever!")
                      ) {
                        handleDelete(activeSubmission);
                      }
                    }}>
                    <TrashIcon className="h-4 w-4" />
                    Delete Submission
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
        <aside className="border-ui-gray-light order-first flex h-full flex-1 flex-shrink-0 flex-col border-r md:w-96 md:flex-none">
          {/*  <DownloadResponses formId={params.formId} /> */}
          <div className="pt-4 pb-2">
            <h2 className="px-5 text-lg font-medium text-gray-900">Responses</h2>
          </div>
          {submissions.length === 0 ? (
            <p className="mt-3 px-5 text-sm text-gray-500">No responses yet</p>
          ) : (
            <RadioGroup
              value={activeSubmission}
              onChange={setActiveSubmission}
              className="mb-32 min-h-0 flex-1 overflow-y-auto shadow-inner"
              as="div">
              <div className="relative">
                <ul className="divide-ui-gray-light relative z-0 divide-y">
                  {submissions.map((submission) => (
                    <RadioGroup.Option
                      key={submission.id}
                      value={submission}
                      className={({ checked }) =>
                        clsx(checked ? "bg-gray-100" : "", "relative flex items-center space-x-3 px-6 py-5 ")
                      }>
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => setActiveSubmission(submission)}
                          className="w-full text-left focus:outline-none">
                          {/* Extend touch target to entire panel */}
                          <span className="absolute inset-0" aria-hidden="true" />
                          <p className="text-sm font-medium text-gray-900">
                            {convertDateTimeString(submission.createdAt)}
                          </p>
                        </button>
                      </div>
                    </RadioGroup.Option>
                  ))}
                </ul>
              </div>
            </RadioGroup>
          )}
        </aside>
      </div>
    </div>
  );
}
