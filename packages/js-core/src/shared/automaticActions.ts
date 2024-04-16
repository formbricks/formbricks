import { TJsPackageType } from "@formbricks/types/js";

import { trackAction as trackInAppAction } from "../in-app/lib/actions";
import { trackAction as trackWebsiteAction } from "../website/lib/actions";
import { err } from "./errors";

let exitIntentListenerAdded = false;

let exitIntentListenerWrapper = async function (e: MouseEvent, packageType: TJsPackageType = "in-app") {
  if (e.clientY <= 0) {
    const trackResult =
      packageType === "in-app"
        ? await trackInAppAction("Exit Intent (Desktop)")
        : await trackWebsiteAction("Exit Intent (Desktop)");

    if (trackResult.ok !== true) {
      return err(trackResult.error);
    }
  }
};

export const addExitIntentListener = (packageType: TJsPackageType = "in-app"): void => {
  if (typeof document !== "undefined" && !exitIntentListenerAdded) {
    document
      .querySelector("body")!
      .addEventListener("mouseleave", (e) => exitIntentListenerWrapper(e, packageType));
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

let scrollDepthListenerWrapper = async (packageType: TJsPackageType = "in-app") => {
  const scrollPosition = window.scrollY;
  const windowSize = window.innerHeight;
  const bodyHeight = document.documentElement.scrollHeight;
  if (scrollPosition === 0) {
    scrollDepthTriggered = false;
  }
  if (!scrollDepthTriggered && scrollPosition / (bodyHeight - windowSize) >= 0.5) {
    scrollDepthTriggered = true;
    const trackResult =
      packageType === "in-app"
        ? await trackInAppAction("50% Scroll")
        : await trackWebsiteAction("50% Scroll");
    if (trackResult.ok !== true) {
      return err(trackResult.error);
    }
  }
};

export const addScrollDepthListener = (packageType: TJsPackageType): void => {
  if (typeof window !== "undefined" && !scrollDepthListenerAdded) {
    window.addEventListener("load", () => {
      window.addEventListener("scroll", () => scrollDepthListenerWrapper(packageType));
    });
    scrollDepthListenerAdded = true;
  }
};

export const removeScrollDepthListener = (packageType: TJsPackageType): void => {
  if (scrollDepthListenerAdded) {
    window.removeEventListener("scroll", () => scrollDepthListenerWrapper(packageType));
    scrollDepthListenerAdded = false;
  }
};
