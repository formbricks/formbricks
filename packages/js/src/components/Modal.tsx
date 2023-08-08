import type { PlacementType } from "@formbricks/types/js";
import { h, VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { cn } from "../lib/utils";

// CSS classes object
const mobileClasses = {
  show: "fb--translate-y-full",
  hide: "fb-translate-y-0",
};

export default function Modal({
  children,
  isOpen,
  placement,
  clickOutside,
  darkOverlay,
  close,
}: {
  children: VNode;
  isOpen: boolean;
  placement: PlacementType;
  clickOutside: boolean;
  darkOverlay: boolean;
  close: () => void;
}) {
  const [show, setShow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const isCenter = placement === "center";
  const modalRef = useRef(null);

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (!isCenter) return;

    function handleClickOutside(event) {
      if (clickOutside && show && modalRef.current && !modalRef.current.contains(event.target)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [show, clickOutside, close, isCenter]);

  const handleMobileClasses = (isMobile, show) => {
    return isMobile ? (show ? mobileClasses.show : mobileClasses.hide) : "";
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // This classes will be applied only when screen size is greater than sm, hence sm is common prefix for all
  const getPlacementStyle = (placement: PlacementType) => {
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

  return (
    <div
      aria-live="assertive"
      className={cn(
        isCenter ? "fb-pointer-events-auto" : "fb-pointer-events-none",
        "fb-fixed fb-inset-0 fb-flex fb-items-end fb-z-999999"
      )}>
      <div
        className={cn(
          "fb-w-full fb-h-full fb-relative",
          show && isCenter
            ? darkOverlay
              ? "sm:fb-bg-gray-700/80"
              : "sm:fb-bg-white/50"
            : "fb-bg-none fb-transition-all fb-duration-500 fb-ease-in-out"
        )}>
        <div
          ref={modalRef}
          className={cn(
            getPlacementStyle(placement),
            show ? "fb-opacity-100" : "fb-opacity-0",
            "fb-h-fit fb-pointer-events-auto fb-absolute fb-w-full sm:fb-max-w-sm fb-overflow-hidden fb-rounded-lg fb-bg-white fb-shadow-lg fb-ring-1 fb-ring-black fb-ring-opacity-5 fb-transition-all fb-duration-500 fb-ease-in-out sm:fb-m-4",
            isMobile && "fb-top-full fb-rounded-t-3xl",
            handleMobileClasses(isMobile, show)
          )}>
          <div class="fb-absolute fb-top-0 fb-right-0 fb-pt-4 fb-pr-4 fb-block">
            <button
              type="button"
              onClick={close}
              class="fb-rounded-md fb-bg-white fb-relative focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 fb-text-slate-400 hover:fb-text-slate-500 focus:ring-slate-500">
              <span class="fb-sr-only">Close</span>
              <svg
                class="fb-h-6 fb-w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="">{children}</div>
        </div>
      </div>
    </div>
  );
}
