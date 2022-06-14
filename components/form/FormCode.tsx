import { RadioGroup } from "@headlessui/react";
import Link from "next/link";
import { useState } from "react";
import { FaReact, FaVuejs } from "react-icons/fa";
import { classNames } from "../../lib/utils";

const libs = [
  {
    id: "react",
    name: "React",
    href: "#",
    bgColor: "bg-cyan-500",
    ringColor: "ring-cyan-500",
    icon: FaReact,
  },
  {
    id: "reactNative",
    name: "React Native",
    comingSoon: true,
    href: "#",
    members: 12,
    bgColor: "bg-cyan-600",
    ringColor: "ring-cyan-600",
    icon: FaReact,
  },
  {
    id: "vue",
    name: "Vue.js",
    comingSoon: true,
    href: "#",
    members: 16,
    bgColor: "bg-emerald-400",
    ringColor: "ring-emerald-400",
    icon: FaVuejs,
  },
];

export default function FormCode() {
  const [selectedLib, setSelectedLib] = useState(null);

  return (
    <>
      <header>
        <div className="mx-auto mt-8 max-w-7xl">
          <h1 className="text-3xl font-bold leading-tight text-gray-900">
            Get started
          </h1>
        </div>
      </header>
      <div className="my-4">
        <p className="text-gray-700">
          Welcome to your new form! To start using snoopHub with your
          application you need to build a form using our libs for your preferred
          programming language or framework.
        </p>
      </div>
      <div className="mt-5">
        <RadioGroup value={selectedLib} onChange={setSelectedLib}>
          <RadioGroup.Label className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            Choose your framework
          </RadioGroup.Label>

          <ul
            role="list"
            className="grid grid-cols-1 gap-5 mt-3 sm:gap-6 sm:grid-cols-3 lg:grid-cols-3"
          >
            {libs.map((lib) => (
              <RadioGroup.Option
                key={lib.id}
                value={lib}
                className={({ checked }) =>
                  classNames(
                    checked ? `ring-2 ${lib.ringColor}` : "",
                    lib.comingSoon ? "opacity-50" : "",
                    "flex col-span-1 rounded-md shadow-sm"
                  )
                }
                disabled={lib.comingSoon}
              >
                {({}) => (
                  <li
                    className={classNames(
                      lib.comingSoon ? "opacity-50" : "",
                      "flex col-span-1 rounded-md shadow-sm w-full"
                    )}
                  >
                    <div
                      className={classNames(
                        lib.bgColor,
                        "flex-shrink-0 flex items-center justify-center w-16 text-white text-sm font-medium rounded-l-md"
                      )}
                    >
                      <lib.icon className="w-5 h-5" />
                    </div>
                    <div
                      className={classNames(
                        lib.comingSoon ? "border-dashed" : "",
                        "flex items-center justify-between flex-1 truncate bg-white border-t border-b border-r border-gray-200 rounded-r-md"
                      )}
                    >
                      <div className="flex-1 px-4 py-5 text-sm truncate">
                        <RadioGroup.Label className="font-medium text-gray-900 hover:text-gray-600">
                          {lib.name}
                        </RadioGroup.Label>
                        {lib.comingSoon && (
                          <p className="inline-block ml-1 text-gray-500">
                            (coming soon)
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                )}
              </RadioGroup.Option>
            ))}
          </ul>
        </RadioGroup>
      </div>
      <div className="mt-10">
        {selectedLib?.id === "react" ? (
          <div className="relative px-5 py-16 overflow-hidden border border-gray-200 rounded-lg shadow-inner">
            <div className="relative px-4 sm:px-6 lg:px-8">
              <div className="mx-auto text-lg max-w-prose">
                <h1>
                  <span className="block text-base font-semibold tracking-wide text-center text-red-600">
                    snoopReact
                  </span>
                  <span className="block mt-2 text-3xl font-extrabold leading-8 tracking-tight text-center text-gray-900 sm:text-4xl">
                    How to build your form
                  </span>
                </h1>
              </div>
              <div className="mx-auto mt-6 text-base prose prose-lg text-gray-500 prose-red">
                <p>
                  Getting the snoopForms React Library up and running with Node
                  Package Manager:
                </p>
                <pre>
                  <code className="language-js">
                    npm install --save @snoopforms/react
                  </code>
                </pre>
                <p>Then build your form using our built-in components</p>
                <pre>
                  <code className="language-js">
                    {`import React from "react";
import { SnoopForm, SnoopElement, SnoopPage } from "@snoopforms/react";

export default function Example({}) {
  return (
    <SnoopForm
      domain="localhost:3000"
      protocol="http"
      className="w-full space-y-6"
      onSubmit={({ submission, schema }) => {
        // do something with the data additional to sending to snoopForms
      }}
    >
      <SnoopPage name="first">
        <SnoopElement
          type="text"
          name={"name"}
          label="Your name"
          classNames={{
            label: "your-label-class",
            element: "your-input-class",
          }}
          required
        />
      </SnoopPage>
      <SnoopPage name="second">
        <SnoopElement
          type="radio"
          name={"importance"}
          label="What's your favorite food?"
          classNames={{
            label: "your-label-class",
            radioGroup: "your-radio-group-class",
            radioOption: "your-radio-option-class",
          }}
          options={["Pizza", "Pasta", "Sushi"]}
        />
        <SnoopElement
          type="submit"
          label="Submit"
          classNames={{
            button: "your-submit-button-class",
          }}
        />
      </SnoopPage>
      <SnoopPage thankyou>
        <h1>Thank you!</h1>
      </SnoopPage>
    </SnoopForm>
  );
}`}
                  </code>
                </pre>
                <p>
                  To read more about building your form with snoopReact, check
                  out our{" "}
                  <Link href="https://docs.snoopforms.com/">
                    <a target="_blank">docs</a>
                  </Link>
                  .
                </p>
                <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                  <div className="flex">
                    <div className="flex-1 ml-3 md:flex md:justify-between">
                      <p className="text-sm text-gray-700">
                        Are you ready to go live and receive submissions? Go to{" "}
                        <Link href="pipelines">
                          <a>Pipelines</a>
                        </Link>{" "}
                        to pipe your submissions to other systems or go straight
                        to the{" "}
                        <Link href="results">
                          <a>Results</a>
                        </Link>{" "}
                        to see how your form is used and keep track of your
                        submissions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
