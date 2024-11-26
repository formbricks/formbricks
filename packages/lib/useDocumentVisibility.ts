import { useEffect } from "react";

// This hook will listen to the visibilitychange event and run the provided function whenever the document's visibility state changes to visible
export const useDocumentVisibility = (onVisible: () => void) => {
  useEffect(() => {
    const listener = () => {
      if (document.visibilityState === "visible") {
        onVisible();
      }
    };

    document.addEventListener("visibilitychange", listener);

    return () => {
      document.removeEventListener("visibilitychange", listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
