"use client";

import { cn } from "@/lib/cn";
import { ReactNode, useEffect, useRef, useState } from "react";
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
  const [windowWidth, setWindowWidth] = useState<number | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(placement === "center");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowWidth(window.innerWidth);

      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener("resize", handleResize);

      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  useEffect(() => {
    setOverlayVisible(placement === "center");
  }, [placement]);

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
    if (!clickOutsideClose || placement !== "center") return;
    const handleClickOutside = (e: MouseEvent) => {
      const previewBase = document.getElementById("preview-survey-base");

      if (
        clickOutsideClose &&
        modalRef.current &&
        previewBase &&
        previewBase.contains(e.target as Node) &&
        !modalRef.current.contains(e.target as Node)
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
  }, [clickOutsideClose, placement]);

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

  return (
    <div
      id="preview-survey-base"
      aria-live="assertive"
      className={cn(
        "relative h-full w-full overflow-hidden rounded-b-md",
        overlayVisible ? (darkOverlay ? "bg-slate-700/80" : "bg-white/50") : "",
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
