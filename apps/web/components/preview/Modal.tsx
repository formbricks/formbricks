import { getPlacementStyle } from "@/lib/preview";
import { cn } from "@formbricks/lib/cn";
import { PlacementType } from "@formbricks/types/js";
import { ReactNode, useEffect, useMemo, useState } from "react";

export default function Modal({
  children,
  isOpen,
  placement,
  highlightBorderColor,
}: {
  children: ReactNode;
  isOpen: boolean;
  placement: PlacementType;
  highlightBorderColor: string | null;
}) {
  const [show, setShow] = useState(false);

  const highlightBorderColorStyle = useMemo(() => {
    if (!highlightBorderColor) return {};

    return {
      border: `2px solid ${highlightBorderColor}`,
      overflow: "hidden",
    };
  }, [highlightBorderColor]);

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);

  return (
    <div aria-live="assertive" className="relative h-full w-full">
      <div
        className={cn(
          show ? "translate-x-0 opacity-100" : "translate-x-32 opacity-0",
          "pointer-events-auto absolute max-h-[90%] w-full max-w-sm overflow-hidden overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-500 ease-in-out",
          getPlacementStyle(placement),
          highlightBorderColorStyle
        )}
        style={highlightBorderColorStyle}>
        {children}
      </div>
    </div>
  );
}
