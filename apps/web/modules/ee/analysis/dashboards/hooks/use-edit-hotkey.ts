"use client";

import { useEffect } from "react";
import { hasOpenOverlay, isEditHotkey, resolveEditHotkeyAction } from "../lib/edit-hotkey";

/**
 * `E` toggles edit mode: it enters from view mode, and inside edit mode it saves when there is something
 * to save and cancels otherwise - the same button the key cap sits on in the control bar.
 */
export const useEditHotkey = ({
  isReadOnly,
  isEditing,
  hasChanges,
  isBusy,
  onEnter,
  onSave,
  onCancel,
}: Readonly<{
  isReadOnly: boolean;
  isEditing: boolean;
  hasChanges: boolean;
  /** A save or an image upload is in flight. */
  isBusy: boolean;
  onEnter: () => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
}>) => {
  useEffect(() => {
    const action = resolveEditHotkeyAction({ isReadOnly, isEditing, hasChanges, isSaving: isBusy });
    if (!action) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isEditHotkey(event) || hasOpenOverlay()) {
        return;
      }

      event.preventDefault();
      if (action === "enter") onEnter();
      else if (action === "save") void onSave();
      else onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, onEnter, onSave, hasChanges, isEditing, isReadOnly, isBusy]);
};
