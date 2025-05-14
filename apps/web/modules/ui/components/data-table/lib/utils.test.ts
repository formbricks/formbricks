import { describe, expect, test, vi } from "vitest";
import { getCommonPinningStyles } from "./utils";

describe("Data Table Utils", () => {
  test("getCommonPinningStyles returns correct styles", () => {
    const mockColumn = {
      getStart: vi.fn().mockReturnValue(101),
      getSize: vi.fn().mockReturnValue(150),
    };

    const styles = getCommonPinningStyles(mockColumn as any);

    expect(styles).toEqual({
      left: "100px",
      position: "sticky",
      width: 150,
      zIndex: 1,
    });

    expect(mockColumn.getStart).toHaveBeenCalledWith("left");
    expect(mockColumn.getSize).toHaveBeenCalled();
  });
});
