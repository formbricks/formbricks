import { getPlacementStyle } from "@/lib/preview";
import { cn } from "@formbricks/lib/cn";
import { PlacementType } from "@formbricks/types/js";
import { ReactNode, useEffect, useState, useRef } from "react";

export default function Modal({
  children,
  isOpen,
  placement,
  previewMode,
}: {
  children: ReactNode;
  isOpen: boolean;
  placement: PlacementType;
  previewMode: string;
}) {
  const [show, setShow] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);

  // scroll to top whenever question in modal changes 
  useEffect(() => {
    if(modalRef.current){
      modalRef.current.scrollTop = 0
    }
  }, [children])


  const slidingAnimationClass =
    previewMode === "desktop"
      ? show
        ? "translate-x-0 opacity-100"
        : "translate-x-32 opacity-0"
      : previewMode === "mobile"
        ? show
          ? "bottom-0"
          : "-bottom-full"
        : "";

  return (
    <div aria-live="assertive" className="relative h-full w-full overflow-hidden">
      <div
        ref={modalRef}
        className={cn(
          "pointer-events-auto absolute max-h-[90%] w-full max-w-sm overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-500 ease-in-out",
          previewMode === "desktop" ? getPlacementStyle(placement) : "max-w-full ",
          slidingAnimationClass
        )}>
        {children}
      </div>
    </div>

  );
}
