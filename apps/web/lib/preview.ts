import { PlacementType } from "@formbricks/types/js";

export const getPlacementStyle = (placement: PlacementType) => {
  switch (placement) {
    case "bottomRight":
      return "bottom-3 sm:right-3";
    case "topRight":
      return "sm:top-3 sm:right-3 bottom-3";
    case "topLeft":
      return "sm:top-3 sm:left-3 bottom-3";
    case "bottomLeft":
      return "bottom-3 sm:left-3";
    case "center":
      return "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2";
    default:
      return "bottom-3 sm:right-3";
  }
};
