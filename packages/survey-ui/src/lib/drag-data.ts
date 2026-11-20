// `DragEvent.dataTransfer` is nullable in the DOM spec, and Firefox hands `null` on some drags, but
// `React.DragEvent` types it non-null, so nothing flags an unguarded read. Every drop target, in the
// app and in the survey, reads it through these helpers so a drag without data does nothing instead
// of crashing the page or ending a live survey, where nothing catches a handler's throw (ENG-3986).
type TDragEventLike = { dataTransfer: DataTransfer | null };

/** Sets the cursor feedback a drag over a drop target shows. Does nothing when the drag has no data. */
export const setDropEffect = (event: TDragEventLike, effect: DataTransfer["dropEffect"]): void => {
  if (event.dataTransfer) event.dataTransfer.dropEffect = effect;
};

/** The browser's list of the files a drop carries, or null when it has no data. */
export const getDroppedFileList = (event: TDragEventLike): FileList | null =>
  event.dataTransfer?.files ?? null;

/** The files a drop carries, or none when it has no data. */
export const getDroppedFiles = (event: TDragEventLike): File[] => Array.from(getDroppedFileList(event) ?? []);

/** The items a drag carries, readable during `dragover` when the files themselves are not yet. */
export const getDraggedItems = (event: TDragEventLike): DataTransferItem[] =>
  Array.from(event.dataTransfer?.items ?? []);
