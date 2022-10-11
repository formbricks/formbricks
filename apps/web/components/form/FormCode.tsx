import { DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { FaReact, FaVuejs } from "react-icons/fa";
import { toast } from "react-toastify";
import { classNames } from "../../lib/utils";
import StandardButton from "../StandardButton";

export default function FormCode({ formId }) {
  const libs = [
    {
      id: "react",
      name: "React",
      href: `/forms/${formId}/form/react`,
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
      icon: DocumentMagnifyingGlassIcon,
      target: "_blank",
    },
  ];

  return (
    <>
      <div className="mx-auto mt-8">
        <h1 className="text-ui-gray-dark text-3xl font-bold leading-tight">Connect your form</h1>
      </div>
      <div className="mt-4 mb-12">
        <p className="text-ui-gray-dark">
          To send all form submissions to this dashboard, update the form ID in the{" "}
          <code>{"<snoopForm>"}</code> component.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-10">
        <div>
          <label htmlFor="formId" className="text-ui-gray-dark block text-base">
            Your form ID
          </label>
          <div className="mt-3">
            <input
              id="formId"
              type="text"
              className="text-md mb-3 w-full rounded-sm border-gray-300 shadow-sm disabled:bg-gray-100"
              value={formId}
              disabled
            />

            <StandardButton
              onClick={() => {
                navigator.clipboard.writeText(formId);
                toast("Copied form ID to clipboard");
              }}
              fullwidth>
              copy
            </StandardButton>
          </div>
        </div>
        <div className="rounded-md bg-black p-8 font-light text-gray-200">
          <p>
            <code>
              {"<"}
              <span className="text-yellow-200">SnoopForm</span>
              {""}
            </code>
          </p>
          <p>
            <code>{`domain="${window?.location.host}"`}</code>
          </p>
          <p>
            <code>{`protocol="${window?.location.protocol.replace(":", "")}"`}</code>
          </p>
          <p>
            <code>{`formId="${formId}"`}</code>
          </p>
          <p>
            <code>{">"}</code>
          </p>
          <p>
            <code>
              <span className="text-gray-600">{`{...}`}</span>
            </code>
          </p>
          <code>
            {"</"}
            <span className="text-yellow-200">SnoopForm</span>
            {">"}
          </code>
        </div>
      </div>
      <div className="mt-16">
        <h2 className="text-ui-gray-dark text-xl font-bold">Code your form</h2>
        <div className="mt-4 mb-12">
          <p className="text-ui-gray-dark">
            Build your form with the code library of your choice. Manage your data in this dashboard.
          </p>
        </div>
        <ul role="list" className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
          {libs.map((lib) => (
            <Link key={lib.id} href={lib.href}>
              <a className="col-span-1 flex rounded-md shadow-sm" target={lib.target || ""} rel="noreferrer">
                <li
                  className={classNames(
                    lib.comingSoon ? "text-ui-gray-medium" : "text-ui-gray-dark shadow-sm hover:text-black",
                    "col-span-1 flex w-full rounded-md"
                  )}>
                  <div
                    className={classNames(
                      lib.bgColor,
                      "flex w-20 flex-shrink-0 items-center justify-center rounded-l-md text-sm font-medium text-white"
                    )}>
                    <lib.icon
                      className={classNames(
                        lib.comingSoon ? "text-ui-gray-medium" : "stroke-1 text-white",
                        "h-10 w-10"
                      )}
                    />
                  </div>
                  <div
                    className={classNames(
                      lib.comingSoon ? "border-dashed" : "",
                      "flex flex-1 items-center justify-between truncate rounded-r-md bg-white"
                    )}>
                    <div className="inline-flex truncate px-4 py-6 text-lg">
                      <p className="font-light">{lib.name}</p>
                      {lib.comingSoon && (
                        <div className="ml-3 rounded bg-green-100 p-1 px-3">
                          <p className="text-xs text-black">coming soon</p>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              </a>
            </Link>
          ))}
        </ul>

        <div className="text-ui-gray-medium my-12 text-center font-light">
          <p>
            Your form is running? Go to{" "}
            <Link href={`/forms/${formId}/preview`}>
              <a className="text-red underline">Pipelines</a>
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
