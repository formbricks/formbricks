import { FaReact, FaVuejs } from "react-icons/fa";
import { DocumentSearchIcon, TerminalIcon } from "@heroicons/react/outline";
import { classNames } from "../../lib/utils";
import StandardButton from "../StandardButton";
import Link from "next/link";
import SecondNavBar from "../layout/SecondNavBar";
import SecondNavBarItem from "../layout/SecondNavBarItem";

export default function FormCode({ formId }) {
  const libs = [
    {
      id: "react",
      name: "React",
      href: `forms/${formId}/react`,
      bgColor: "bg-blue",
      version: "v0.1",
      icon: FaReact,
    },
    {
      id: "reactNative",
      name: "React Native",
      comingSoon: true,
      href: "#",
      bgColor: "bg-ui-gray-light",
      icon: FaReact,
    },
    {
      id: "vue",
      name: "Vue.js",
      comingSoon: true,
      href: "#",
      bgColor: "bg-ui-gray-light",
      icon: FaVuejs,
    },
    {
      id: "docs",
      name: "Docs",
      href: "https://docs.snoopforms.com",
      bgColor: "bg-ui-gray-dark",
      icon: DocumentSearchIcon,
    },
  ];

  return (
    <>
      <SecondNavBar>
        <SecondNavBarItem link href={`/forms/${formId}/form`}>
          <TerminalIcon className="w-8 h-8 mx-auto stroke-1" />
          formID
        </SecondNavBarItem>
        <SecondNavBarItem link href={`/forms/${formId}/react`}>
          <FaReact className="w-8 h-8 mx-auto stroke-1" />
          React
        </SecondNavBarItem>
        <SecondNavBarItem disabled>
          <FaReact className="w-8 h-8 mx-auto stroke-1" />
          React Native
        </SecondNavBarItem>
        <SecondNavBarItem disabled>
          <FaVuejs className="w-8 h-8 mx-auto stroke-1" />
          Vue
        </SecondNavBarItem>
        <SecondNavBarItem link outbound href="https://docs.snoopforms.com">
          <DocumentSearchIcon className="w-8 h-8 mx-auto stroke-1" />
          Docs
        </SecondNavBarItem>
      </SecondNavBar>
      <header>
        <div className="max-w-5xl">
          <div className="mx-auto mt-8">
            <h1 className="text-3xl font-bold leading-tight text-ui-gray-dark">
              Connect your form
            </h1>
          </div>
        </div>
      </header>
      <div className="max-w-5xl">
        <div className="mt-4 mb-12">
          <p className="text-ui-gray-dark">
            To send all form submissions to this dashboard, update the form ID
            in the <code>{"<snoopForm>"}</code> component.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10">
          <div>
            <label
              htmlFor="formId"
              className="block text-base text-ui-gray-dark"
            >
              Your form ID
            </label>
            <div className="mt-3">
              <input
                id="formId"
                type="text"
                className="w-full mb-3 text-lg font-bold border-gray-300 rounded-sm shadow-sm disabled:bg-gray-100"
                value={formId}
                disabled
              />

              <StandardButton
                onClick={() => {
                  navigator.clipboard.writeText(formId);
                }}
                fullwidth
              >
                copy
              </StandardButton>
            </div>
          </div>
          <div className="p-8 font-light text-gray-200 bg-black rounded-md">
            <p>
              <code>
                {"<"}
                <span className="text-yellow-200">snoopForm</span>
                {""}
              </code>
            </p>
            <p>
              <code>{'domain="localhost:3000"'}</code>
            </p>
            <p>
              <code>{'protocol="http"'}</code>
            </p>
            <p>
              <code className="font-bold text-red">{'formId="luHwCdbz"'}</code>
            </p>
            <p>
              <code>{"onSubmit={({ submission, schema }) =>{}/>"}</code>
            </p>
          </div>
        </div>
        <div className="mt-16">
          <h2 className="text-xl font-bold text-ui-gray-dark">
            Code your form
          </h2>
          <div className="mt-4 mb-12">
            <p className="text-ui-gray-dark">
              Build your form with the code library of your choice. Manage your
              data in this dashboard.
            </p>
          </div>
          <ul
            role="list"
            className="grid grid-cols-1 gap-5 mt-3 sm:gap-6 sm:grid-cols-2"
          >
            {libs.map((lib) => (
              <a
                className="flex col-span-1 rounded-md shadow-sm"
                key={lib.id}
                href={lib.href}
              >
                <li
                  className={classNames(
                    lib.comingSoon
                      ? "text-ui-gray-medium"
                      : "shadow-sm text-ui-gray-dark hover:text-black",
                    "flex col-span-1 rounded-md w-full"
                  )}
                >
                  <div
                    className={classNames(
                      lib.bgColor,
                      "flex-shrink-0 flex items-center justify-center w-20 text-white text-sm font-medium rounded-md"
                    )}
                  >
                    <lib.icon
                      className={classNames(
                        lib.comingSoon
                          ? "text-ui-gray-medium"
                          : "text-white stroke-1",
                        "w-12 h-12"
                      )}
                    />
                  </div>
                  <div
                    className={classNames(
                      lib.comingSoon ? "border-dashed" : "",
                      "flex items-center justify-between flex-1 truncate bg-white rounded-r-md"
                    )}
                  >
                    <div className="inline-flex px-4 py-8 text-lg truncate">
                      <p className="font-light">{lib.name}</p>
                      {lib.comingSoon && (
                        <div className="p-1 px-3 ml-3 bg-green-100 rounded">
                          <p className="text-xs text-black">coming soon</p>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              </a>
            ))}
          </ul>

          <div className="my-12 font-light text-center text-ui-gray-medium">
            <p>
              Your form is running? Go to{" "}
              <Link href={`/forms/${formId}/preview`}>
                <a className="underline text-red">Pipelines</a>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
