import { cn } from "@/lib/utils";
import { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { TPlacement } from "@formbricks/types/common";

interface ModalProps {
  children: VNode;
  isOpen: boolean;
  placement: TPlacement;
  clickOutside: boolean;
  darkOverlay: boolean;
  highlightBorderColor: string | null;
  onClose: () => void;
}

export const Modal = ({ children, isOpen, placement, clickOutside, darkOverlay, onClose }: ModalProps) => {
  const [show, setShow] = useState(false);
  const isCenter = placement === "center";
  const modalRef = useRef(null);

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (!isCenter) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        clickOutside &&
        show &&
        modalRef.current &&
        !(modalRef.current as HTMLElement).contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [show, clickOutside, onClose, isCenter]);

  // This classes will be applied only when screen size is greater than sm, hence sm is common prefix for all
  const getPlacementStyle = (placement: TPlacement) => {
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
    <div
      aria-live="assertive"
      className={cn(
        isCenter ? "fb-pointer-events-auto" : "fb-pointer-events-none",
        "fb-z-999999 fb-fixed fb-inset-0 fb-flex fb-items-end"
      )}>
      <div
        className={cn(
          "fb-relative fb-h-full fb-w-full",
          isCenter
            ? darkOverlay
              ? "fb-bg-gray-700/80"
              : "fb-bg-white/50"
            : "fb-bg-none fb-transition-all fb-duration-500 fb-ease-in-out"
        )}>
        <div
          ref={modalRef}
          className={cn(
            getPlacementStyle(placement),
            show ? "fb-opacity-100" : "fb-opacity-0",
            "fb-rounded-custom fb-pointer-events-auto fb-absolute fb-bottom-0 fb-h-fit fb-w-full fb-overflow-visible fb-bg-white fb-shadow-lg fb-transition-all fb-duration-500 fb-ease-in-out sm:fb-m-4 sm:fb-max-w-sm"
          )}>
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
};
