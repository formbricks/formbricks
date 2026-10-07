import { TPlacement } from "@formbricks/types/common";

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
