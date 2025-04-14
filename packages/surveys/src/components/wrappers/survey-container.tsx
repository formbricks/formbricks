import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "preact/hooks";
import { type TPlacement } from "@formbricks/types/common";

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
        return "fb:sm:bottom-3 fb:sm:right-3";
      case "topRight":
        return "fb:sm:top-3 fb:sm:right-3 fb:sm:bottom-3";
      case "topLeft":
        return "fb:sm:top-3 fb:sm:left-3 fb:sm:bottom-3";
      case "bottomLeft":
        return "fb:sm:bottom-3 fb:sm:left-3";
      case "center":
        return "fb:sm:top-1/2 fb:sm:left-1/2 fb:sm:transform fb:sm:-translate-x-1/2 fb:sm:-translate-y-1/2";
      default:
        return "fb:sm:bottom-3 fb:sm:right-3";
    }
  };

  if (!show) return null;

  if (!isModal) {
    return (
      <div id="fbjs" className="fb-formbricks-form" style={{ height: "100%", width: "100%" }}>
        {children}
      </div>
    );
  }

  return (
    <div id="fbjs" className="fb-formbricks-form">
      <div
        aria-live="assertive"
        className={cn(
          isCenter ? "fb:pointer-events-auto" : "fb:pointer-events-none",
          isModal && "fb:z-999999 fb:fixed fb:inset-0 fb:flex fb:items-end"
        )}>
        <div
          className={cn(
            "fb:relative fb:h-full fb:w-full",
            !isCenter ? "fb:bg-none fb:transition-all fb:duration-500 fb:ease-in-out" : "",
            isModal && isCenter && darkOverlay ? "fb:bg-slate-700/80" : "",
            isModal && isCenter && !darkOverlay ? "fb:bg-white/50" : ""
          )}>
          <div
            ref={modalRef}
            className={cn(
              getPlacementStyle(placement),
              show ? "fb:opacity-100" : "fb:opacity-0",
              "fb:rounded-custom fb:pointer-events-auto fb:absolute fb:bottom-0 fb:h-fit fb:w-full fb:overflow-visible fb:bg-white fb:shadow-lg fb:transition-all fb:duration-500 fb:ease-in-out fb:sm:m-4 fb:sm:max-w-sm"
            )}>
            <div>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
