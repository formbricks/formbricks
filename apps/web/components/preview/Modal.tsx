import { cn } from "@formbricks/lib/cn";
import { ReactNode, useEffect, useState } from "react";

export default function Modal({ children, isOpen }: { children: ReactNode; isOpen: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);

  return (
    <div aria-live="assertive" className="flex w-full grow items-end justify-end p-4">
      <div
        className={cn(
          show ? "translate-x-0 opacity-100" : "translate-x-32 opacity-0",
          "pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg   bg-white px-4 py-6 shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-500 ease-in-out sm:p-6"
        )}>
        {children}
      </div>
    </div>
  );
}
