import { cn } from "@formbricks/lib/cn";
import { ReactNode, useEffect, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/solid";

export default function Modal({
  children,
  isOpen,
  reset,
}: {
  children: ReactNode;
  isOpen: boolean;
  reset: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);

  return (
    <div aria-live="assertive" className="absolute inset-0 flex cursor-pointer items-end px-4 py-6 sm:p-6">
      <div className="flex w-full flex-col items-center  sm:items-end">
        <div
          className={cn(
            show ? "opacity-100" : "opacity-0",
            "mr-6 flex items-center rounded-t bg-amber-500 px-3 text-sm font-semibold text-white transition-all duration-500 ease-in-out hover:cursor-pointer"
          )}
          onClick={reset}>
          <ArrowPathIcon className="mr-1.5 mt-0.5 h-4 w-4 " />
          Preview
        </div>
        <div
          className={cn(
            show ? "translate-x-0 opacity-100" : "translate-x-28 opacity-0",
            "pointer-events-auto w-full max-w-sm  overflow-hidden rounded-lg border-2  border-amber-400 bg-white px-4 py-6 shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-500 ease-in-out sm:p-6"
          )}>
          {children}
        </div>
      </div>
    </div>
  );
}
