"use client";

import { type Dispatch, type RefObject, type SetStateAction, useCallback, useRef, useState } from "react";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { type TImageUploadTicket, createImageUploadTracker, setDraftImageFile } from "../lib/dashboard-draft";

/**
 * Image uploads in flight. Save waits for them, and none starts while a save is in flight, so an upload
 * ending is never dropped from the draft the save sends, nor cleared with it after.
 */
export const useImageUploads = ({
  savingRef,
  editSessionRef,
  setDraftWidgets,
}: Readonly<{
  savingRef: RefObject<boolean>;
  /** The edit session open now, `null` when not editing. */
  editSessionRef: RefObject<number | null>;
  setDraftWidgets: Dispatch<SetStateAction<TDashboardWidget[] | null>>;
}>) => {
  const uploadsRef = useRef(0);
  const [isUploading, setIsUploading] = useState(false);
  // Which upload is each image block's latest: an upload's file goes into the draft only if it is still
  // that and its edit session is still open, however its block was remounted.
  const [imageUploads] = useState(createImageUploadTracker);

  const handleImageUploadStart = useCallback(
    (widgetId: string): TImageUploadTicket | null => {
      const editSession = editSessionRef.current;
      if (savingRef.current || editSession === null) return null;
      uploadsRef.current += 1;
      setIsUploading(true);
      return imageUploads.start(widgetId, editSession);
    },
    [editSessionRef, imageUploads, savingRef]
  );

  const handleImageUploadEnd = useCallback(
    (ticket: TImageUploadTicket, fileUrl: string | null) => {
      // Always released, even for an upload whose file is dropped, so Save is never held by it.
      uploadsRef.current = Math.max(0, uploadsRef.current - 1);
      setIsUploading(uploadsRef.current > 0);
      const applies = imageUploads.end(ticket, editSessionRef.current);
      // Applied to the draft as it is now, so settings changed while the upload ran are kept.
      if (applies && fileUrl !== null) {
        setDraftWidgets((current) =>
          current === null ? current : setDraftImageFile(current, ticket.widgetId, fileUrl)
        );
      }
    },
    [editSessionRef, imageUploads, setDraftWidgets]
  );

  return { uploadsRef, isUploading, handleImageUploadStart, handleImageUploadEnd };
};
