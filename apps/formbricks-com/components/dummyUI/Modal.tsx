import { ReactNode, useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";

export default function Modal({
  children,
  isOpen,
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
    <div aria-live="assertive" className="flex  items-end">
      <div className="flex w-full flex-col items-center p-4  sm:items-end md:min-w-[390px]">
        <div
          className={cn(
            show ? "translate-x-0 opacity-100" : "translate-x-28 opacity-0",
            "pointer-events-auto w-full  max-w-sm overflow-hidden rounded-lg bg-white px-4 py-6 shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-500 ease-in-out dark:bg-slate-900 sm:p-6"
          )}>
          {children}
        </div>
      </div>
    </div>
  );
}
