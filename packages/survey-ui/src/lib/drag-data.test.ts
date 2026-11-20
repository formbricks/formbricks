import { describe, expect, test } from "vitest";
import { getDraggedItems, getDroppedFileList, getDroppedFiles, setDropEffect } from "./drag-data";

// `DragEvent.dataTransfer` is nullable in the DOM spec and Firefox hands `null` on some drags, though
// React types it non-null. A drag over a drop target used to crash the survey editor there, and could
// end a live survey at a file-upload question (ENG-3986).
const withoutData = { dataTransfer: null };

const withData = (data: Partial<DataTransfer>) => ({ dataTransfer: data as DataTransfer });

describe("setDropEffect", () => {
  test("sets the drop effect on the drag's data", () => {
    const event = withData({ dropEffect: "none" });

    setDropEffect(event, "copy");

    expect(event.dataTransfer.dropEffect).toBe("copy");
  });

  test("does nothing when the drag carries no data", () => {
    expect(() => setDropEffect(withoutData, "copy")).not.toThrow();
  });
});

describe("getDroppedFileList", () => {
  test("returns the browser's file list", () => {
    const files = { length: 1 } as FileList;

    expect(getDroppedFileList(withData({ files }))).toBe(files);
  });

  test("returns null when the drop carries no data", () => {
    expect(getDroppedFileList(withoutData)).toBeNull();
  });
});

describe("getDroppedFiles", () => {
  test("returns the dropped files", () => {
    const file = new File(["a,b"], "contacts.csv", { type: "text/csv" });

    expect(getDroppedFiles(withData({ files: [file] as unknown as FileList }))).toEqual([file]);
  });

  test("returns no files when the drop carries no data", () => {
    expect(getDroppedFiles(withoutData)).toEqual([]);
  });
});

describe("getDraggedItems", () => {
  test("returns the dragged items", () => {
    const item = { kind: "file", type: "text/csv" } as DataTransferItem;

    expect(getDraggedItems(withData({ items: [item] as unknown as DataTransferItemList }))).toEqual([item]);
  });

  test("returns no items when the drag carries no data", () => {
    expect(getDraggedItems(withoutData)).toEqual([]);
  });
});
