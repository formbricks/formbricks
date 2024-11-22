import { Column } from "@tanstack/react-table";
import { CSSProperties } from "react";

export const getCommonPinningStyles = <T>(column: Column<T>): CSSProperties => {
  return {
    left: `${column.getStart("left") - 1}px`,
    position: "sticky",
    width: column.getSize(),
    zIndex: 1,
  };
};
