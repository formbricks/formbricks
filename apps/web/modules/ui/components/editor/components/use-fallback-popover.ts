"use client";

import { useCallback, useState } from "react";

/**
 * The fallback popover's open state, shared by the rich-text editor and the one-line recall input: a
 * click on a Variable chip opens it on that chip's field; any other way in (the pencil, a Variable
 * just inserted) opens it on the newest one, so the chip's focus is forgotten on close.
 */
export const useFallbackPopover = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusItemId, setFocusItemId] = useState<string | undefined>();

  const setOpen = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) setFocusItemId(undefined);
  }, []);

  const openForChip = useCallback((recallId: string | undefined) => {
    setFocusItemId(recallId);
    setIsOpen(true);
  }, []);

  return { isOpen, setOpen, focusItemId, openForChip };
};
