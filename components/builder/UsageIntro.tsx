/* This example requires Tailwind CSS v2.0+ */
import { InformationCircleIcon } from "@heroicons/react/solid";
import { useState } from "react";

export default function UsageIntro() {
  const [dismissed, setDismissed] = useState(false);
  return (
    !dismissed && (
      <div className="p-4 bg-gray-100 border border-gray-700 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <InformationCircleIcon
              className="w-5 h-5 text-blue-400"
              aria-hidden="true"
            />
          </div>
          <div className="flex-1 ml-3 md:flex md:justify-between">
            <p className="text-sm text-gray-700">
              Welcome to the snoopForms No-Code Editor. Use &apos;tab&apos; to
              add new blocks or change their options. You can also drag &apos;n
              drop blocks to reorder them.
            </p>
            <p className="mt-3 text-sm md:mt-0 md:ml-6">
              <a
                onClick={() => setDismissed(true)}
                className="font-medium text-gray-700 whitespace-nowrap hover:text-gray-600"
              >
                Dismiss
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  );
}
