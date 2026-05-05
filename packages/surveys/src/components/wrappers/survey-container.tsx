import { type ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TOverlay, type TPlacement } from "@formbricks/types/common";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

interface SurveyContainerProps {
  mode: "modal" | "inline";
  placement?: TPlacement;
  overlay?: TOverlay;
  children: ComponentChildren;
  onClose?: () => void;
  clickOutside?: boolean;
  isOpen?: boolean;
  dir?: "ltr" | "rtl" | "auto";
}

export function SurveyContainer({
  mode,
  placement = "bottomRight",
  overlay = "none",
  children,
  onClose,
  clickOutside,
  isOpen = true,
  dir = "auto",
}: Readonly<SurveyContainerProps>) {
  const isModal = mode === "modal";
  const { t } = useTranslation();
  const modalRef = useFocusTrap<HTMLDivElement>({ enabled: isModal && isOpen, onEscapeKeyDown: onClose });
  const hasOverlay = overlay !== "none";

  useEffect(() => {
    if (!isModal) return;
    if (!clickOutside) return;
    if (!hasOverlay) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
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
  }, [clickOutside, hasOverlay, modalRef, onClose, isModal, isOpen]);

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

  if (!isOpen) return null;

  if (!isModal) {
    return (
      <div id="fbjs" className="formbricks-form" style={{ height: "100%", width: "100%" }} dir={dir}>
        {children}
      </div>
    );
  }

  return (
    <div id="fbjs" className="formbricks-form" dir={dir}>
      <div
        aria-live="assertive"
        className={cn(
          hasOverlay ? "pointer-events-auto" : "pointer-events-none",
          isModal && "fixed inset-0 z-999999 flex items-end"
        )}>
        <div
          className={cn(
            "relative h-full w-full transition-all duration-500 ease-in-out",
            isModal && overlay === "dark" ? "bg-slate-700/80" : "",
            isModal && overlay === "light" ? "bg-slate-400/50" : ""
          )}>
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("common.survey_dialog")}
            tabIndex={-1}
            className={cn(
              getPlacementStyle(placement),
              isOpen ? "opacity-100" : "opacity-0",
              "rounded-custom pointer-events-auto absolute bottom-0 h-fit w-full overflow-visible bg-white shadow-lg transition-all duration-500 ease-in-out sm:m-4 sm:max-w-sm"
            )}>
            <div>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
