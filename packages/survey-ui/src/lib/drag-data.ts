type TDragEventLike = { dataTransfer: DataTransfer };

/** Sets the cursor feedback a drag over a drop target shows. */
export const setDropEffect = (event: TDragEventLike, effect: DataTransfer["dropEffect"]): void => {
  event.dataTransfer.dropEffect = effect;
};

/** The browser's list of the files a drop carries. */
export const getDroppedFileList = (event: TDragEventLike): FileList => event.dataTransfer.files;

/** The files a drop carries. */
export const getDroppedFiles = (event: TDragEventLike): File[] => Array.from(getDroppedFileList(event));

/** The items a drag carries, readable during `dragover` when the files themselves are not yet. */
export const getDraggedItems = (event: TDragEventLike): DataTransferItem[] =>
  Array.from(event.dataTransfer.items);
