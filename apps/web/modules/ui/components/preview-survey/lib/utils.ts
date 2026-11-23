import { TPlacement } from "@formbricks/types/common";
import { resolveDarkColors } from "@formbricks/types/dark-palette";
import type { TSurveyLanguage, TSurveyStyling } from "@formbricks/types/surveys/types";
import type { TWorkspaceStyling } from "@formbricks/types/workspace";

export type TPreviewType = "modal" | "fullwidth" | "email";

export const getPlacementStyle = (placement: TPlacement) => {
  switch (placement) {
    case "bottomRight":
      return "bottom-3 sm:right-3";
    case "topRight":
      return "sm:top-6 sm:right-6";
    case "topLeft":
      return "sm:top-6 sm:left-6";
    case "bottomLeft":
      return "bottom-3 sm:left-3";
    case "center":
      return "top-1/2 left-1/2 transform -translate-x-1/2! -translate-y-1/2";
    default:
      return "bottom-3 sm:right-3";
  }
};

/**
 * Editor-preview twin of `mirrorPlacementForDir` in `packages/surveys/src/lib/utils.ts`. The preview
 * positions the survey with its own fake-browser chrome rather than the widget's SurveyContainer, so
 * without this the preview would keep the popup on the authored side while the shipped widget mirrors
 * it — the one surface where an author checks placement would be the one lying about it.
 *
 * Duplicated rather than shared for the same reason `isRTLLanguage` already is: the surveys package
 * is a Preact bundle the web app loads dynamically, so importing a helper out of it would pull that
 * bundle into the editor's own chunk.
 */
export const mirrorPlacementForDir = (placement: TPlacement, dir: "ltr" | "rtl" | "auto"): TPlacement => {
  if (dir !== "rtl") return placement;

  switch (placement) {
    case "bottomRight":
      return "bottomLeft";
    case "bottomLeft":
      return "bottomRight";
    case "topRight":
      return "topLeft";
    case "topLeft":
      return "topRight";
    default:
      return placement;
  }
};

/**
 * Whether an event target sits inside a survey root (`#fbjs`): the card's own, or the separate root an
 * open dropdown portals into. In a preview that portal mounts inside the mock page, beside the card
 * (ENG-3552), so a click-outside check has to treat it as part of the survey.
 */
export const isInsideSurveyRoot = (target: EventTarget | null): boolean =>
  typeof Element !== "undefined" && target instanceof Element && target.closest('[id="fbjs"]') !== null;

/** The preview kind the caller asked for, or a modal once the workspace's app setup is done. */
export const resolvePreviewType = (
  previewType: TPreviewType | undefined,
  appSetupCompleted: boolean
): TPreviewType => previewType ?? (appSetupCompleted ? "modal" : "fullwidth");

/** The test value for the page address, trimmed; undefined without a page-address field or value. */
export const getPreviewPageUrl = (
  hasPageUrlField: boolean,
  value: string | undefined
): string | undefined => {
  if (!hasPageUrlField) return undefined;
  return value?.trim() || undefined;
};

/** The mock modal's card color, which follows the dark palette in dark appearance. */
export const getModalBackground = (
  appearance: "light" | "dark",
  styling: TSurveyStyling | TWorkspaceStyling
): string | undefined =>
  appearance === "dark" ? resolveDarkColors(styling).cardBackgroundColor : styling.cardBackgroundColor?.light;

/** Positions of the backdrop and the preview frame, pinned to the viewport in full-screen preview. */
export const getFullScreenPreviewStyles = (isFullScreen: boolean) => {
  if (isFullScreen) {
    return {
      backdrop: { position: "fixed" as const, zIndex: 50, left: 0, top: 0 },
      frame: { left: "2.5%", top: 0 },
    };
  }
  return {
    backdrop: { position: "absolute" as const, zIndex: 50, left: undefined, top: undefined },
    frame: { left: undefined, top: undefined },
  };
};

/** The mock modal's slide-in state: from the side in the browser frame, from below in the phone. */
export const getSlidingAnimationClass = (previewMode: string, show: boolean): string => {
  if (previewMode === "desktop") {
    return show ? "translate-x-0 opacity-100" : "translate-x-32 opacity-0";
  }
  if (previewMode === "mobile") {
    return show ? "bottom-0" : "-bottom-full";
  }
  return "";
};

/**
 * The language the preview renders in: the one last chosen in the preview, unless that language is
 * no longer enabled, in which case the survey's default (`"default"`). The editor only resets the
 * preview when the language it is EDITING stops being enabled, so a language picked with the
 * in-survey switch would otherwise outlive being disabled.
 */
export const resolvePreviewLanguageCode = (
  activeLanguageCode: string,
  enabledLanguages: readonly Pick<TSurveyLanguage, "default" | "language">[]
): string =>
  activeLanguageCode === "default" ||
  enabledLanguages.some((l) => !l.default && l.language.code === activeLanguageCode)
    ? activeLanguageCode
    : "default";
