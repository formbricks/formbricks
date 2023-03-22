import { h, VNode } from "preact";
import { useEffect, useState } from "preact/hooks";
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
    <div
      aria-live="assertive"
      className="fb-pointer-events-none fb-fixed fb-inset-0 fb-flex fb-items-end fb-px-4 fb-py-6 sm:fb-p-6">
      <div className="fb-flex fb-w-full fb-flex-col fb-items-center fb-space-y-4 sm:fb-items-end">
        <div
          className={cn(
            show ? "fb-translate-x-0 fb-opacity-100" : "fb-translate-x-28 fb-opacity-0",
            "fb-pointer-events-auto fb-relative fb-w-full fb-max-w-sm fb-overflow-hidden fb-rounded-lg fb-bg-white fb-shadow-lg fb-ring-1 fb-ring-black fb-ring-opacity-5 fb-transition-all fb-duration-500 fb-ease-in-out"
          )}>
          <div class="fb-absolute fb-top-0 fb-right-0 fb-hidden fb-pt-4 fb-pr-4 sm:fb-block">
            <button
              type="button"
              onClick={close}
              class="fb-rounded-md fb-bg-white focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 text-slate-400 hover:text-slate-500 focus:ring-slate-500">
              <span class="fb-sr-only">Close</span>
              <svg
                class="fb-h-6 fb-w-6"
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
