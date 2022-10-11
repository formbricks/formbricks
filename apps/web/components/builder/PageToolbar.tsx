/* This example requires Tailwind CSS v2.0+ */
import { TrashIcon } from "@heroicons/react/24/solid";
import { MdWavingHand } from "react-icons/md";
import { classNames } from "../../lib/utils";

export default function PageToolbar({ page, pageIdx, deletePageAction, setPageType }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-gray-200" />
      </div>
      <div className="relative flex justify-center">
        <span className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm">
          <button
            type="button"
            onClick={() => {
              if (page.type === "form") {
                return setPageType("thankyou");
              } else if (page.type === "thankyou") {
                return setPageType("form");
              }
            }}
            className={classNames(
              page.type === "thankyou"
                ? "bg-red-400 text-white hover:bg-red-500"
                : "bg-white text-gray-400 hover:bg-gray-50",
              "has-tooltip relative inline-flex items-center rounded-l-md border border-gray-300 px-4  py-2 text-sm font-medium  focus:z-10 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            )}>
            <span className="sr-only">Thank You Page</span>
            <span className="tooltip -mt-16 -ml-10 w-32 rounded bg-gray-600 p-1 text-xs text-white shadow-lg">
              Is Thank You Page
            </span>
            <MdWavingHand className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Do you really want to delete this page?")) {
                deletePageAction(pageIdx);
              }
            }}
            className="has-tooltip relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-400 hover:bg-gray-50 focus:z-10 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500">
            <span className="sr-only">Delete</span>
            <span className="tooltip -mt-16 -ml-8 w-24 rounded bg-gray-600 p-1 text-xs text-white shadow-lg">
              Delete Page
            </span>
            <TrashIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </span>
      </div>
    </div>
  );
}
