"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { useWorkspace } from "@/lib/workspaces";
import { Button } from "@formbricks/ui";
import { UserIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/router";
import Prism from "prismjs";
import { useEffect, useMemo, useState } from "react";
import { AiFillApi } from "react-icons/ai";
import { toast } from "react-toastify";

require("prismjs/components/prism-javascript");

const tabs = [
  { id: "overview", name: "Overview", icon: UserIcon },
  { id: "api", name: "API", icon: AiFillApi },
];

export default function FormOverviewPage() {
  const router = useRouter();
  const { form, isLoadingForm, isErrorForm } = useForm(
    router.query.formId?.toString(),
    router.query.workspaceId?.toString()
  );
  const { workspace, isLoadingWorkspace, isErrorWorkspace } = useWorkspace(
    router.query.workspaceId?.toString()
  );
  const [activeTab, setActiveTab] = useState(tabs[0]);

  const capturePostUrl = useMemo(() => {
    if (form) {
      return `${window.location.protocol}//${window.location.host}/api/capture/forms/${form.id}/submissions`;
    }
  }, [form]);

  useEffect(() => {
    if (!isLoadingForm) {
      Prism.highlightAll();
    }
  }, [isLoadingForm]);

  if (isLoadingForm || isLoadingWorkspace) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorForm || isErrorWorkspace) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }
  return (
    <div className="mx-auto py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
          {form.label}
          <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
            {workspace.name}
          </span>
        </h1>
      </header>
      <div>
        <div>
          <div className="sm:hidden">
            <label htmlFor="tabs" className="sr-only">
              Select a tab
            </label>
            {/* Use an "onChange" listener to redirect the user to the selected tab URL. */}
            <select
              id="tabs"
              name="tabs"
              className="block w-full rounded-md border-gray-300 focus:border-teal-500 focus:ring-teal-500"
              defaultValue={activeTab.name}>
              {tabs.map((tab) => (
                <option key={tab.name}>{tab.name}</option>
              ))}
            </select>
          </div>
          <div className="hidden sm:block">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.name}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      activeTab.name === tab.name
                        ? "border-teal-500 text-teal-600"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
                      "group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium"
                    )}
                    aria-current={activeTab.name === tab.name ? "page" : undefined}>
                    <tab.icon
                      className={clsx(
                        activeTab.name === tab.name
                          ? "text-teal-500"
                          : "text-gray-400 group-hover:text-gray-500",
                        "-ml-0.5 mr-2 h-5 w-5"
                      )}
                      aria-hidden="true"
                    />
                    <span>{tab.name}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {activeTab.id === "overview" ? (
          <div>
            <div className="grid grid-cols-5 gap-8 py-4">
              <div className="col-span-3">
                <div>
                  <label htmlFor="formId" className="block text-lg font-semibold text-slate-800">
                    Your form ID
                  </label>
                  <div className="mt-3 w-96">
                    <input
                      id="formId"
                      type="text"
                      className="focus:border-brand focus:ring-brand block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100 sm:text-sm"
                      value={form.id}
                      disabled
                    />

                    <Button
                      variant="secondary"
                      className="mt-2 w-full justify-center"
                      onClick={() => {
                        navigator.clipboard.writeText(form.id);
                        toast("Copied form ID to clipboard");
                      }}>
                      copy
                    </Button>
                  </div>
                </div>

                <div className="max-w-2xl py-6">
                  <label htmlFor="formId" className="block text-lg font-semibold text-slate-800">
                    Capture POST Url:
                  </label>
                  <div className="mt-3">
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-200 px-3 text-gray-500  sm:text-sm">
                        POST
                      </span>
                      <input
                        id="captureUrl"
                        type="text"
                        className="focus:border-brand focus:ring-brand block w-full rounded-r-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm"
                        value={capturePostUrl}
                        disabled
                      />
                    </div>

                    <Button
                      variant="secondary"
                      className="mt-2 w-full justify-center"
                      onClick={() => {
                        navigator.clipboard.writeText(capturePostUrl);
                        toast("Copied form url to clipboard");
                      }}>
                      copy
                    </Button>
                  </div>
                </div>
              </div>

              <div className="col-span-2  text-sm text-gray-600">
                <h3 className="block text-lg font-semibold text-slate-800">How to get started</h3>
                <ol className="list-decimal leading-8 text-slate-700">
                  <li>POST a submission to the capture endpoint.</li>
                  <li>
                    View submission under{" "}
                    <Link
                      href={`/workspaces/${router.query.workspaceId}/forms/${router.query.formId}/submissions`}
                      className="underline">
                      Submissions
                    </Link>{" "}
                    tab.
                  </li>
                  <li>
                    Get notified or pipe submission data to a different tool in the{" "}
                    <Link
                      href={`/workspaces/${router.query.workspaceId}/forms/${router.query.formId}/pipelines`}
                      className="underline">
                      Pipelines
                    </Link>{" "}
                    tab.
                  </li>
                  <li>
                    For a summary of form data a schema is required. Learn all about schemas in our{" "}
                    <Link
                      target="_blank"
                      href="https://formbricks.com/docs/formbricks-hq/schema"
                      className="underline">
                      docs
                    </Link>
                    .
                  </li>
                </ol>
              </div>
            </div>
          </div>
        ) : activeTab.id === "api" ? (
          <div>
            <div className="grid grid-cols-5 gap-8 py-4">
              <div className="col-span-3">
                <div>
                  <label htmlFor="formId" className="block text-lg font-semibold text-slate-800">
                    Capture POST Url:
                  </label>
                  <div className="mt-3">
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-200 px-3 text-gray-500  sm:text-sm">
                        POST
                      </span>
                      <input
                        id="captureUrl"
                        type="text"
                        className="focus:border-brand focus:ring-brand block w-full rounded-r-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm"
                        value={`${window.location.protocol}//${window.location.host}/api/capture/forms/${form.id}/submissions`}
                        disabled
                      />
                    </div>

                    <Button
                      variant="secondary"
                      className="mt-2 w-full justify-center"
                      onClick={() => {
                        navigator.clipboard.writeText(form.id);
                        toast("Copied form url to clipboard");
                      }}>
                      copy
                    </Button>
                  </div>
                </div>
                <div className="mt-4 rounded-md bg-black p-4 font-light text-gray-200 first-letter:text-sm">
                  <pre>
                    <code className="language-js whitespace-pre-wrap">
                      {`{
"customerId": "user@example.com", /* optional */
"data": {
  "firstname": "John",
  "lastname": "Doe",
  "feedback": "I like the app very much"
  }
}`}
                    </code>
                  </pre>
                </div>
              </div>
              <div className="col-span-2  text-sm text-gray-600">
                <h3 className="block pb-4 text-lg font-semibold text-slate-800">Quick Tips</h3>
                <p className="font-bold">Authentication</p>
                <p className="my-3 text-sm text-gray-600">
                  Via the API you can send submissions directly to Formbricks HQ. The API doesn&apos;t need
                  any authentication and can also be called in the users browser.
                </p>
                <p className="pt-3 font-bold">CustomerId</p>
                <p className="my-3 text-sm text-gray-600">
                  You can pass along a customer ID to identify the respondent. This allows you to attribute
                  submissions of several surveys to the same respondent.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
