export const getPlacementClasses = (placement) => {
  switch (placement) {
    case "bottomRight":
      return "bottom-3 right-3";
    case "topRight":
      return "top-3 right-3";
    case "topLeft":
      return "top-3 left-3";
    case "bottomLeft":
      return "bottom-3 left-3";
    case "center":
      return "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2";
    default:
      return "bottom-3 right-3";
  }
};
