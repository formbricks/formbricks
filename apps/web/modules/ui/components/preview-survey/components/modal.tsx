"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { TOverlay, TPlacement } from "@formbricks/types/common";
import { cn } from "@/lib/cn";
import { getOverlayPreviewStyle } from "@/modules/ui/components/overlay-settings/lib/utils";
import { PREVIEW_BOUNDARY_CLASS_NAME, previewBoundaryProps } from "../lib/containment";
import { getPlacementStyle, isInsideSurveyRoot } from "../lib/utils";

interface ModalProps {
  children: ReactNode;
  isOpen: boolean;
  placement: TPlacement;
  previewMode: string;
  clickOutsideClose: boolean;
  overlay: TOverlay;
  overlayColor?: string | null;
  overlayOpacity?: number | null;
  borderRadius?: number | string;
  background?: string;
}

export const Modal = ({
  children,
  isOpen,
  placement,
  previewMode,
  clickOutsideClose,
  overlay,
  overlayColor = null,
  overlayOpacity = null,
  borderRadius,
  background,
}: Readonly<ModalProps>) => {
  const [show, setShow] = useState(true);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [windowWidth, setWindowWidth] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowWidth(window.innerWidth);

      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener("resize", handleResize);

      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  const calculateScaling = () => {
    if (windowWidth === null) return {};

    let scaleValue = "1";

    if (previewMode !== "mobile") {
      if (windowWidth > 1600) {
        scaleValue = "1";
      } else if (windowWidth > 1200) {
        scaleValue = ".9";
      } else if (windowWidth > 900) {
        scaleValue = ".8";
      } else {
        scaleValue = "0.7";
      }
    }

    let placementClass = "";

    if (placement === "bottomLeft") {
      placementClass = "bottom left";
    } else if (placement === "bottomRight") {
      placementClass = "bottom right";
    } else if (placement === "topLeft") {
      placementClass = "top left";
    } else if (placement === "topRight") {
      placementClass = "top right";
    }

    return {
      transform: `scale(${scaleValue})`,
      transformOrigin: placementClass,
    };
  };

  const scalingClasses = calculateScaling();

  useEffect(() => {
    if (!clickOutsideClose) return;
    const handleClickOutside = (e: MouseEvent) => {
      const previewBase = document.getElementById("preview-survey-base");

      if (
        modalRef.current &&
        previewBase &&
        previewBase.contains(e.target as Node) &&
        !modalRef.current.contains(e.target as Node) &&
        // An open dropdown mounts its own #fbjs root inside this box, outside the card (ENG-3552).
        // Picking an option there is a click in the survey, not outside it.
        !isInsideSurveyRoot(e.target)
      ) {
        setShow(false);
        setTimeout(() => {
          setShow(true);
        }, 1000);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [clickOutsideClose]);

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.scrollTop = 0;
    }
  }, [children]);

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

  const customOverlayStyle = getOverlayPreviewStyle({ overlay, overlayColor, overlayOpacity });

  return (
    <div
      id="preview-survey-base"
      aria-live="assertive"
      // The mock page is the survey's trusted, contained box (see lib/containment.ts).
      {...previewBoundaryProps}
      className={cn(
        "h-full w-full rounded-b-md",
        PREVIEW_BOUNDARY_CLASS_NAME,
        !customOverlayStyle && overlay === "dark" ? "bg-slate-700/80" : "",
        !customOverlayStyle && overlay === "light" ? "bg-slate-400/50" : "",
        "transition-all duration-500 ease-in-out"
      )}
      style={customOverlayStyle}>
      <div
        ref={modalRef}
        style={{
          ...scalingClasses,
          ...(borderRadius !== undefined && {
            borderRadius: typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius,
          }),
          ...(background && {
            background,
          }),
        }}
        className={cn(
          "pointer-events-auto absolute max-h-[90%] w-full max-w-sm no-scrollbar transition-all duration-500 ease-in-out",
          previewMode === "desktop" ? getPlacementStyle(placement) : "max-w-full",
          slidingAnimationClass
        )}>
        {children}
      </div>
    </div>
  );
};
