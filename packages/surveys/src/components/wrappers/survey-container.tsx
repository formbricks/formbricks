import { useEffect, useRef, useState } from "react";
import { type TPlacement } from "@formbricks/types/common";
import { cn } from "../../lib/utils";

interface SurveyContainerProps {
  mode: "modal" | "inline";
  placement?: TPlacement;
  darkOverlay?: boolean;
  children: React.ReactNode;
  onClose?: () => void;
  clickOutside?: boolean;
  isOpen?: boolean;
}

export function SurveyContainer({
  mode,
  placement = "bottomRight",
  darkOverlay = false,
  children,
  onClose,
  clickOutside,
  isOpen = true,
}: SurveyContainerProps) {
  const [show, setShow] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const isCenter = placement === "center";
  const isModal = mode === "modal";

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (!isModal) return;
    if (!isCenter) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        clickOutside &&
        show &&
        modalRef.current &&
        !(modalRef.current as HTMLElement).contains(e.target as Node) &&
        onClose
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [show, clickOutside, onClose, isCenter, isModal]);

  const getPlacementStyle = (placement: TPlacement): string => {
    switch (placement) {
      case "bottomRight":
        return "sm:bottom-3 sm:right-3";
      case "topRight":
        return "sm:top-3 sm:right-3 sm:bottom-3";
      case "topLeft":
        return "sm:top-3 sm:left-3 sm:bottom-3";
      case "bottomLeft":
        return "sm:bottom-3 sm:left-3";
      case "center":
        return "sm:top-1/2 sm:left-1/2 sm:transform sm:-translate-x-1/2 sm:-translate-y-1/2";
      default:
        return "sm:bottom-3 sm:right-3";
    }
  };

  if (!show) return null;

  if (!isModal) {
    return (
      <div id="fbjs" className="formbricks-form" style={{ height: "100%", width: "100%" }}>
        {children}
      </div>
    );
  }

  return (
    <div id="fbjs" className="formbricks-form">
      <div
        aria-live="assertive"
        className={cn(
          isCenter ? "pointer-events-auto" : "pointer-events-none",
          isModal && "z-999999 fixed inset-0 flex items-end"
        )}>
        <div
          className={cn(
            "relative h-full w-full",
            !isCenter ? "bg-none transition-all duration-500 ease-in-out" : "",
            isModal && isCenter && darkOverlay ? "bg-slate-700/80" : "",
            isModal && isCenter && !darkOverlay ? "bg-white/50" : ""
          )}>
          <div
            ref={modalRef}
            className={cn(
              getPlacementStyle(placement),
              show ? "opacity-100" : "opacity-0",
              "rounded-custom pointer-events-auto absolute bottom-0 h-fit w-full overflow-visible bg-white shadow-lg transition-all duration-500 ease-in-out sm:m-4 sm:max-w-sm"
            )}>
            <div>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
