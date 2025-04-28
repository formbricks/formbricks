import { RefObject, useEffect } from "react";

// Custom hook to synchronize the horizontal scroll position of two elements.
export const useSyncScroll = (
  highlightContainerRef: RefObject<HTMLElement | HTMLInputElement | null>,
  inputRef: RefObject<HTMLElement | HTMLInputElement | null>
): void => {
  useEffect(() => {
    const syncScrollPosition = () => {
      if (highlightContainerRef.current && inputRef.current) {
        highlightContainerRef.current.scrollLeft = inputRef.current.scrollLeft;
      }
    };

    const sourceElement = inputRef.current;
    if (sourceElement) {
      sourceElement.addEventListener("scroll", syncScrollPosition);
    }

    return () => {
      if (sourceElement) {
        sourceElement.removeEventListener("scroll", syncScrollPosition);
      }
    };
  }, [inputRef, highlightContainerRef]);
};
