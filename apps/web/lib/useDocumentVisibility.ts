import { useEffect, useRef } from "react";

// This hook will listen to the visibilitychange event and run the provided function whenever the document's visibility state changes to visible
export const useDocumentVisibility = (onVisible: () => void) => {
  // Keep the latest callback in a ref so the listener always calls the current
  // `onVisible` without having to re-subscribe on every render.
  const onVisibleRef = useRef(onVisible);
  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    const listener = () => {
      if (document.visibilityState === "visible") {
        onVisibleRef.current();
      }
    };

    document.addEventListener("visibilitychange", listener);

    return () => {
      document.removeEventListener("visibilitychange", listener);
    };
  }, []);
};
