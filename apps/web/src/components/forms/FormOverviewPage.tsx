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
import { useEffect, useState } from "react";
import { AiFillApi } from "react-icons/ai";
import { FaReact, FaVuejs } from "react-icons/fa";
import { toast } from "react-toastify";

require("prismjs/components/prism-javascript");

const tabs = [
  { id: "overview", name: "Overview", icon: UserIcon },
  { id: "api", name: "API", icon: AiFillApi },
  { id: "react", name: "React", icon: FaReact },
  { id: "vue", name: "Vue", icon: FaVuejs },
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
        ) : activeTab.id === "react" ? (
          <div>
            <div className="mt-5 grid grid-cols-5 gap-8">
              <div className="col-span-3 rounded-md bg-black p-4 text-sm font-light text-gray-200">
                <pre>
                  <code className="language-js whitespace-pre-wrap">
                    {`import { Form, Text, Email, Checkbox, Submit, sendToHq } from "@formbricks/react";
import "@formbricks/react/styles.css";

export default function WaitlistForm() {
return (
<Form formId="${form.id}" hqUrl="${window.location.protocol}//${window.location.host}" onSubmit={sendToHq}> 
  <Text name="name" label="What's your name?" validation="required" />
  <Email
    name="email"
    label="What's your email address?"
    placeholder="you@example.com"
    validation="required|email"
  />
  <Checkbox
    name="terms"
    label="Terms & Conditions"
    help="To use our service, please accept."
    validation="accepted"
  />
  <Submit label="Let's go!" />
</Form>
);
}`}
                  </code>
                </pre>
              </div>
              <div className="col-span-2">
                <h3 className="block text-lg font-semibold text-slate-800">Formbricks React</h3>
                <p className="my-3 text-sm text-gray-600">
                  The best way to send submissions to Formbricks HQ in React is{" "}
                  <Link
                    target="_blank"
                    className="underline"
                    href="https://www.npmjs.com/package/@formbricks/react">
                    Formbricks React.
                  </Link>{" "}
                  It makes form creation easy and automatically creates a schema to get a full picture of your
                  data in the Summary tab.
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-5 gap-8">
              <div className="col-span-3 rounded-md bg-black p-4 text-sm font-light text-gray-200">
                <pre>
                  <code className="language-js whitespace-pre-wrap">
                    {`
<form
onSubmit={(e) => {
  e.preventDefault();
  fetch(
    "${window.location.protocol}//${window.location.host}/api/capture/forms/${form.id}/submissions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          firstname: e.target.firstname.value,
          email: e.target.email.value,
        },
      }),
    }
  );
  console.log("submission sent!");
  e.target.reset();
}}
>
<label htmlFor="firstname">First name</label>
<input type="text" name="firstname" id="firstname" />
<label htmlFor="email">Email</label>
<input type="email" name="email" id="email" placeholder="you@example.com" />

<button type="submit">Submit</button>
</form>`}
                  </code>
                </pre>
              </div>
              <div className="col-span-2">
                <h3 className="block text-lg font-semibold text-slate-800">Standard React Forms</h3>
                <p className="my-3 text-sm text-gray-600">
                  You can also use the default React Form functionality (or another form library) to send the
                  submissions to Formbricks HQ.
                </p>
              </div>
            </div>
          </div>
        ) : activeTab.id === "vue" ? (
          <div>
            <div className="mt-5 grid grid-cols-5 gap-8">
              <div className="col-span-3 rounded-md bg-black p-4 text-sm font-light text-gray-200">
                <pre>
                  <code className="language-js whitespace-pre-wrap">
                    {`<template>
  <form @submit.prevent="submitForm">
    <label>
      <span>Email</span>
      <input type="email" name="email" v-model="email" />
    </label>
    <label>
      <span>Message</span>
      <textarea name="message" v-model="message"></textarea>
    </label>
    <button type="submit">Submit</button>
  </form>
</template>

<script>
export default {
  data() {
    return {
      email: '',
      message: '',
      endpoint: '${window.location.protocol}//${window.location.host}/capture/forms/${form.id}/submissions',
    }
  },
  methods: {
    async submitForm() {
      const data = {
        email: this.email,
        message: this.message,
      }
      const response = await this.$axios.post(this.endpoint, {data})
    },
  },
}
</script>`}
                  </code>
                </pre>
              </div>
              <div className="col-span-2">
                <h3 className="block text-lg font-semibold text-slate-800">Standard Vue Forms</h3>
                <p className="my-3 text-sm text-gray-600">
                  You can also use the default Vue form functionality to send submissions to Formbricks HQ.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* <div className="mt-16">
          <h2 className="text-xl font-bold text-slate-800">Code your form</h2>
          <div className="">
            <p className="text-slate-800">
              Build your form with the code library of your choice. Manage your data in this dashboard.
            </p>
          </div>
          <ul role="list" className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
            {libs.map((lib) => (
              <Link
                key={lib.id}
                href={lib.href}
                className={clsx(
                  "col-span-1 flex rounded-md shadow-sm",
                  lib.disabled && "pointer-events-none"
                )}
                target={lib.target || ""}
                rel="noreferrer">
                <li
                  className={clsx(
                    lib.comingSoon ? "text-slate-500" : "text-slate-800 shadow-sm hover:text-black",
                    "col-span-1 flex w-full rounded-md"
                  )}>
                  <div
                    className={clsx(
                      lib.bgColor || "bg-slate-300",
                      "flex w-20 flex-shrink-0 items-center justify-center rounded-l-md text-sm font-medium text-white"
                    )}>
                    <lib.icon
                      className={clsx(lib.comingSoon ? "text-slate-100" : "stroke-1 text-white", "h-10 w-10")}
                    />
                  </div>
                  <div
                    className={clsx(
                      lib.comingSoon ? "border-dashed" : "",
                      "flex flex-1 items-center justify-between truncate rounded-r-md bg-white"
                    )}>
                    <div className="inline-flex truncate px-4 py-6 text-lg">
                      <p className="font-light">{lib.name}</p>
                      {lib.comingSoon && (
                        <div className="ml-3 rounded bg-teal-100 p-1 px-3">
                          <p className="text-xs text-black">coming soon</p>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              </Link>
            ))}
          </ul>

          <div className="my-12 text-center font-light text-slate-500">
            <p>
              Your form is running? Go to{" "}
              <Link href={`/forms/${form.id}/preview`} className="text-red underline">
                Pipelines
              </Link>
            </p>
          </div>
        </div> */}
      </div>
    </div>
  );
}
