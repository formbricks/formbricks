import { trackEvent } from "./event";
import { err } from "./errors";

export const addExitIntentListener = (): void => {
  if (typeof document !== "undefined") {
    const exitIntentListener = async function (e: MouseEvent) {
      if (e.clientY <= 0) {
        const trackResult = await trackEvent("Exit Intent (Desktop)");
        if (trackResult.ok !== true) {
          return err(trackResult.error);
        }
      }
    };
    document.addEventListener("mouseleave", exitIntentListener);
  }
};

export const addScrollDepthListener = (): void => {
  if (typeof window !== "undefined") {
    let scrollDepthTriggered = false;
    // 'load' event is used to setup listener after full page load
    window.addEventListener("load", () => {
      window.addEventListener("scroll", async () => {
        const scrollPosition = window.pageYOffset;
        const windowSize = window.innerHeight;
        const bodyHeight = document.documentElement.scrollHeight;
        if (scrollPosition === 0) {
          scrollDepthTriggered = false;
        }
        if (!scrollDepthTriggered && scrollPosition / (bodyHeight - windowSize) >= 0.5) {
          scrollDepthTriggered = true;
          const trackResult = await trackEvent("50% Scroll");
          if (trackResult.ok !== true) {
            return err(trackResult.error);
          }
        }
      });
    });
  }
};
