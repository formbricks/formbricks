import { getPlacementStyle } from "@/lib/preview";
import { cn } from "@formbricks/lib/cn";
import { PlacementType } from "@formbricks/types/js";
import { ReactNode, useEffect, useState } from "react";

export default function Modal({
  children,
  isOpen,
  placement,
}: {
  children: ReactNode;
  isOpen: boolean;
  placement: PlacementType;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);

  return (
    <div aria-live="assertive" className="relative h-full w-full">
      <div
        className={cn(
          show ? "translate-x-0 opacity-100" : "translate-x-32 opacity-0",
          "pointer-events-auto absolute h-fit w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-500 ease-in-out",
          getPlacementStyle(placement)
        )}>
        {children}
      </div>
    </div>
  );
}
