"use client";

import LoadingSpinner from "@/app/LoadingSpinner";
import { useForm } from "@/lib/forms";
import { useTeam } from "@/lib/teams";
import { Button } from "@formbricks/ui";
import clsx from "clsx";
import Link from "next/link";
import Prism from "prismjs";
import { useEffect, useMemo } from "react";
import { FaReact, FaVuejs } from "react-icons/fa";
import { AiFillHtml5 } from "react-icons/ai";
import { toast } from "react-toastify";

require("prismjs/components/prism-javascript");

const getLibs = (formId: string) => [
  {
    id: "react",
    name: "React",
    href: `https://formbricks.com/docs/react-form-library/introduction`,
    bgColor: "bg-brand-dark",
    target: "_blank",
    icon: FaReact,
  },
  {
    id: "html",
    name: "HTML",
    href: `https://formbricks.com/docs/react-form-library/link-formbricks-hq`,
    bgColor: "bg-brand-dark",
    target: "_blank",
    icon: AiFillHtml5,
  },
  {
    id: "reactNative",
    name: "React Native",
    comingSoon: true,
    href: "#",
    disabled: true,
    icon: FaReact,
  },
  {
    id: "vue",
    name: "Vue.js",
    comingSoon: true,
    href: "#",
    disabled: true,
    icon: FaVuejs,
  },
];

export default function FormsPage({ params }) {
  const { form, isLoadingForm, isErrorForm } = useForm(params.formId, params.teamId);
  const { team, isLoadingTeam, isErrorTeam } = useTeam(params.teamId);
  const libs = useMemo(() => {
    if (form) {
      return getLibs(form.id);
    }
  }, [form]);

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
        <div className="mx-auto mt-8">
          <h1 className="text-xl font-bold leading-tight text-slate-900">Connect your form</h1>
        </div>

        <div className="grid grid-cols-2 gap-10">
          <div>
            <div className="mt-4 mb-12">
              <p className="text-slate-700">
                To get started post your submission to the Formbricks HQ capture endpoint. To enable the
                summary feature also set the schema of this form.
                <br />
                If you are using the Formbricks React Library it&apos;s even easier to get started. All you
                need is you formId and we take care of the rest (including the schema).
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
          <div className="rounded-md bg-black p-8 font-light text-gray-200">
            <pre>
              <code className="language-js whitespace-pre-wrap">
                {`import { Form, Text, Email, Checkbox, Submit, sendToHQ } from "@formbricks/react";
import "@formbricks/react/styles.css";

export default function WaitlistForm() {
  return (
    <Form id="${form.id}" onSubmit={sendToHQ}>
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
        </div>
        <div className="mt-16">
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
        </div>
      </div>
    </div>
  );
}
