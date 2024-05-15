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

  return (
    <div
      aria-live="assertive"
      className={cn(
        isCenter ? "pointer-events-auto" : "pointer-events-none",
        "z-999999 fixed inset-0 flex items-end"
      )}>
      <div
        className={cn(
          "relative h-full w-full",
          isCenter
            ? darkOverlay
              ? "bg-gray-700/80"
              : "bg-white/50"
            : "bg-none transition-all duration-500 ease-in-out"
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
  );
};
