import { getPlacementStyle } from "@/lib/preview";
import { cn } from "@formbricks/lib/cn";
import { PlacementType } from "@formbricks/types/js";
import { ReactNode, useEffect, useState } from "react";

export default function Modal({
  children,
  isOpen,
  placement,
  previewMode
}: {
  children: ReactNode;
  isOpen: boolean;
  placement: PlacementType;
  previewMode: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);

  const slidingAnimationClass =
    previewMode === "desktop"
      ? show
        ? "translate-x-0 opacity-100"
        : "translate-x-32 opacity-0"
      : previewMode === "mobile"
      ? show
        ? "translate-y-0"
        : "translate-y-full"
      : "";

  return (
    <div aria-live="assertive" className="relative h-full w-full overflow-hidden">
      <div
        className={cn(
          "pointer-events-auto absolute max-h-[90%] w-full max-w-sm overflow-hidden overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-500 ease-in-out",
          previewMode === "desktop" ? getPlacementStyle(placement) : "bottom-3 max-w-full",
          slidingAnimationClass,
        )}
      >
        {children}
      </div>
    </div>
  );
}
