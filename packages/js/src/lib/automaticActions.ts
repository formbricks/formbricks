import { trackAction } from "./actions";
import { err } from "./errors";

let exitIntentListenerAdded = false;

let exitIntentListenerWrapper = async function (e: MouseEvent) {
  if (e.clientY <= 0) {
    const trackResult = await trackAction("Exit Intent (Desktop)");
    if (trackResult.ok !== true) {
      return err(trackResult.error);
    }
  }
};

export const addExitIntentListener = (): void => {
  if (typeof document !== "undefined" && !exitIntentListenerAdded) {
    document.querySelector("body")!.addEventListener("mouseleave", exitIntentListenerWrapper);
    exitIntentListenerAdded = true;
  }
};

export const removeExitIntentListener = (): void => {
  if (exitIntentListenerAdded) {
    document.removeEventListener("mouseleave", exitIntentListenerWrapper);
    exitIntentListenerAdded = false;
  }
};

let scrollDepthListenerAdded = false;
let scrollDepthTriggered = false;
let scrollDepthListenerWrapper = async () => {
  const scrollPosition = window.scrollY;
  const windowSize = window.innerHeight;
  const bodyHeight = document.documentElement.scrollHeight;
  if (scrollPosition === 0) {
    scrollDepthTriggered = false;
  }
  if (!scrollDepthTriggered && scrollPosition / (bodyHeight - windowSize) >= 0.5) {
    scrollDepthTriggered = true;
    const trackResult = await trackAction("50% Scroll");
    if (trackResult.ok !== true) {
      return err(trackResult.error);
    }
  }
};

export const addScrollDepthListener = (): void => {
  if (typeof window !== "undefined" && !scrollDepthListenerAdded) {
    window.addEventListener("load", () => {
      window.addEventListener("scroll", scrollDepthListenerWrapper);
    });
    scrollDepthListenerAdded = true;
  }
};

export const removeScrollDepthListener = (): void => {
  if (scrollDepthListenerAdded) {
    window.removeEventListener("scroll", scrollDepthListenerWrapper);
    scrollDepthListenerAdded = false;
  }
};
