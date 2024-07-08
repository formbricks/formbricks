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
      return "top-1/2 left-1/2 transform !-translate-x-1/2 -translate-y-1/2";
    default:
      return "bottom-3 sm:right-3";
  }
};
