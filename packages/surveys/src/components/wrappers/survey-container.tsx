import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
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

  // const modalRef = useRef<HTMLDivElement>(null);
  const isCenter = placement === "center";
  const isModal = mode === "modal";

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);

  const getPlacementStyle = (placement: TPlacement): string => {
    switch (placement) {
      case "bottomRight":
        return "sm:fb-bottom-3 sm:fb-right-3";
      case "topRight":
        return "sm:fb-top-3 sm:fb-right-3 sm:fb-bottom-3";
      case "topLeft":
        return "sm:fb-top-3 sm:fb-left-3 sm:fb-bottom-3";
      case "bottomLeft":
        return "sm:fb-bottom-3 sm:fb-left-3";
      case "center":
        return "sm:fb-top-1/2 sm:fb-left-1/2 sm:fb-transform sm:-fb-translate-x-1/2 sm:-fb-translate-y-1/2";
      default:
        return "sm:fb-bottom-3 sm:fb-right-3";
    }
  };

  if (!show) return null;

  return (
    // <div
    //   id="fbjs"
    //   className={cn(
    //     "fb-formbricks-form",
    //     isModal && "fb-fixed fb-inset-0 fb-z-[999999]",
    //     isCenter ? "fb-pointer-events-auto" : "fb-pointer-events-none"
    //   )}
    //   style={{
    //     background:
    //       isModal && isCenter
    //         ? darkOverlay
    //           ? "rgba(51, 65, 85, 0.8)"
    //           : "rgba(255, 255, 255, 0.9)"
    //         : "transparent",
    //   }}
    //   onClick={(e) => {
    //     if (clickOutside && isCenter && e.target === e.currentTarget) {
    //       onClose?.();
    //     }
    //   }}>
    //   <div
    //     className={cn(
    //       "fb-survey-content",
    //       "fb-absolute",
    //       "fb-w-full fb-max-w-[600px]",
    //       "fb-pointer-events-auto",
    //       getPlacementStyle(placement)
    //     )}>
    //     {children}
    //   </div>
    // </div>

    <div id="fbjs" className="fb-formbricks-form">
      <div
        aria-live="assertive"
        className={cn(
          isCenter ? "fb-pointer-events-auto" : "fb-pointer-events-none",
          isModal && "fb-z-999999 fb-fixed fb-inset-0 fb-flex fb-items-end"
        )}
        onClick={(e) => {
          if (clickOutside && show && e.target === e.currentTarget) {
            onClose?.();
          }
        }}>
        <div
          className={cn(
            "fb-relative fb-h-full fb-w-full",
            !isCenter ? "fb-bg-none fb-transition-all fb-duration-500 fb-ease-in-out" : "",
            isModal && isCenter && darkOverlay ? "fb-bg-slate-700/80" : "",
            isModal && isCenter && !darkOverlay ? "fb-bg-white/50" : ""
          )}>
          <div
            // ref={modalRef}
            className={cn(
              getPlacementStyle(placement),
              show ? "fb-opacity-100" : "fb-opacity-0",
              "fb-rounded-custom fb-pointer-events-auto fb-absolute fb-bottom-0 fb-h-fit fb-w-full fb-overflow-visible fb-bg-white fb-shadow-lg fb-transition-all fb-duration-500 fb-ease-in-out sm:fb-m-4 sm:fb-max-w-sm"
            )}>
            <div>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
