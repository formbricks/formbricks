"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TPlacement } from "@formbricks/types/common";
import { getPlacementStyle } from "../lib/utils";

interface ModalProps {
  children: ReactNode;
  isOpen: boolean;
  placement: TPlacement;
  previewMode: string;
  clickOutsideClose: boolean;
  darkOverlay: boolean;
  borderRadius?: number;
  background?: string;
}

export const Modal = ({
  children,
  isOpen,
  placement,
  previewMode,
  clickOutsideClose,
  darkOverlay,
  borderRadius,
  background,
}: ModalProps) => {
  const [show, setShow] = useState(true);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [overlayVisible, setOverlayVisible] = useState(true);

  const calculateScaling = () => {
    let scaleValue = "1";

    if (previewMode === "mobile") {
      scaleValue = "1";
    } else {
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
  const overlayStyle = overlayVisible && darkOverlay ? "bg-gray-700/80" : "bg-white/50";

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!clickOutsideClose) {
      setOverlayVisible(true);
      setShow(true);
    }
    const previewBase = document.getElementById("preview-survey-base");
    const handleClickOutside = (e: MouseEvent) => {
      // Checks if the positioning is center, clickOutsideClose is set & if the click is inside the preview screen but outside the survey modal
      if (
        scalingClasses.transformOrigin === "" &&
        clickOutsideClose &&
        modalRef.current &&
        previewBase &&
        previewBase.contains(e.target as Node) &&
        !modalRef.current.contains(e.target as Node)
      ) {
        setTimeout(() => {
          setOverlayVisible(false);
          setShow(false);
        }, 500);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [clickOutsideClose, scalingClasses.transformOrigin]);

  useEffect(() => {
    setShow(isOpen);
  }, [isOpen]);

  // scroll to top whenever question in modal changes
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

  return (
    <div
      id="preview-survey-base"
      aria-live="assertive"
      className={cn(
        "relative h-full w-full overflow-hidden rounded-b-md",
        overlayStyle,
        "transition-all duration-500 ease-in-out"
      )}>
      <div
        ref={modalRef}
        style={{
          ...scalingClasses,
          ...(borderRadius && {
            borderRadius: `${borderRadius}px`,
          }),
          ...(background && {
            background,
          }),
        }}
        className={cn(
          "no-scrollbar pointer-events-auto absolute max-h-[90%] w-full max-w-sm transition-all duration-500 ease-in-out",
          previewMode === "desktop" ? getPlacementStyle(placement) : "max-w-full",
          slidingAnimationClass
        )}>
        {children}
      </div>
    </div>
  );
};
