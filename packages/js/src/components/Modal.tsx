import { h, VNode } from "preact";
import { useEffect, useState } from "preact/compat";
import { cn } from "../lib/utils";

export default function Modal({
  children,
  isOpen,
  close,
}: {
  children: VNode;
  isOpen: boolean;
  close: () => void;
}) {
  const [show, setShow] = useState(false);
  /* useEffect(() => {
    setLoaded(true);
  }, []); */

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);
  return (
    <div aria-live="assertive" className="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:p-6">
      <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
        <div
          className={cn(
            show ? "translate-x-0 opacity-100" : "translate-x-28 opacity-0",
            "pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-500 ease-in-out"
          )}>
          <div class="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
            <button
              type="button"
              onClick={close}
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2">
              <span class="sr-only">Close</span>
              <svg
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="">{children}</div>
        </div>
      </div>
    </div>
  );
}
