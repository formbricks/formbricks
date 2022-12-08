"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { useTeam } from "@/lib/teams";
import { Button } from "@formbricks/ui";
import { UserIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/router";
import Prism from "prismjs";
import { useEffect, useMemo, useState } from "react";
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
    router.query.teamId?.toString()
  );
  const { team, isLoadingTeam, isErrorTeam } = useTeam(router.query.teamId?.toString());
  const [activeTab, setActiveTab] = useState(tabs[0]);

  useEffect(() => {
    if (!isLoadingForm) {
      Prism.highlightAll();
    }
  }, [isLoadingForm]);

  if (isLoadingForm || isLoadingTeam) {
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
          {form.label}
          <span className="text-brand-dark ml-4 inline-flex items-center rounded-md border border-teal-100 bg-teal-50 px-2.5 py-0.5 text-sm font-medium">
            {team.name}
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
            <div>
              <div className="mt-4 mb-12 text-sm text-gray-600">
                <p className="text-slate-700">
                  To get started post your submission to the Formbricks HQ capture endpoint. All submissions
                  are stored in Formbricks HQ and can be viewed here.
                  <br /> <br />
                  If you want to get notified when a submission is made you can also set up a webhook or email
                  notifications in{" "}
                  <Link
                    href={`/app/teams/${router.query.teamId}/forms/${router.query.formId}/pipelines`}
                    className="underline">
                    Pipelines
                  </Link>
                  .<br />
                  <br />
                  Optionally you can set a schema for your form. This schema tells Formbricks HQ more about
                  the structure of your form and enables better form evaluation, e.g. displays the correct
                  labels for your form fields in the Formbricks HQ UI insted of the fieldName or filters data
                  that doesn&apos;t match the schema. The easiest way to get started with a schema is to used
                  our react library because it handles schema creation and sending to Formbricks HQ
                  automatically.
                  <br /> To learn more about the schema please check out our{" "}
                  <Link href="https://formbricks.com/docs/formbricks-hq/schema">docs</Link>.
                </p>
              </div>

              <div>
                <label htmlFor="formId" className="block text-base text-slate-800">
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
              <hr className="my-6" />
              <div className="max-w-2xl">
                <label htmlFor="formId" className="block text-base text-slate-800">
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
                      value={`${window.location.protocol}//${window.location.host}/capture/forms/${form.id}/submissions`}
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
          </div>
        ) : activeTab.id === "api" ? (
          <div className="mt-5">
            <p className="my-3 text-sm text-gray-600">
              You can send submissions directly to Formbricks HQ via our API. The API doesn&apos;t need any
              authentication and can also called in the users browser.
            </p>
            <hr className="my-8" />
            <div className="max-w-2xl">
              <label htmlFor="formId" className="block text-base text-slate-800">
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
                    value={`${window.location.protocol}//${window.location.host}/capture/forms/${form.id}/submissions`}
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
            <hr className="my-8" />
            <div className="rounded-md bg-black p-8 text-sm font-light text-gray-200">
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
        ) : activeTab.id === "react" ? (
          <div className="mt-5">
            <p className="my-3 text-sm text-gray-600">
              The best way to send submissions to Formbricks HQ in React is our simple to use{" "}
              <Link target="_blank" href="https://www.npmjs.com/package/@formbricks/react">
                React Library
              </Link>
              because it also creates and sends a schema to Formbricks HQ.
            </p>
            <div className="rounded-md bg-black p-8 text-sm font-light text-gray-200">
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
            <p className="my-3 text-sm text-gray-600">
              But you can also use the default React Form functionality (or another form library) to send the
              submissions to Formbricks HQ.
            </p>
            <div className="rounded-md bg-black p-8 text-sm font-light text-gray-200">
              <pre>
                <code className="language-js whitespace-pre-wrap">
                  {`<form
onSubmit={({ data }) => {
  fetch("${window.location.protocol}//${window.location.host}/capture/forms/${form.id}/submissions", {
    method: "POST",
    body: JSON.stringify({data}),
    headers: {
      Accept: "application/json",
    },
  });
}}>
{/* YOUR FORM */}
</form>`}
                </code>
              </pre>
            </div>
          </div>
        ) : activeTab.id === "vue" ? (
          <div className="mt-5">
            {" "}
            <p className="my-3 text-sm text-gray-600">
              To send a submission in Vue.Js you can use the default form functionality.
            </p>
            <div className="rounded-md bg-black p-8 text-sm font-light text-gray-200">
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
          </div>
        ) : null}

        {/* <div className="mt-16">
          <h2 className="text-xl font-bold text-slate-800">Code your form</h2>
          <div className="mt-4 mb-12">
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
