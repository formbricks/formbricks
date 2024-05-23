import { TJsPackageType } from "@formbricks/types/js";

import { trackNoCodeAction as trackInAppAction } from "../app/lib/actions";
import { trackNoCodeAction as trackWebsiteAction } from "../website/lib/actions";
import { err } from "./errors";

let exitIntentListenerAdded = false;

let exitIntentListenerWrapper = async (e: MouseEvent, packageType: TJsPackageType) => {
  if (e.clientY <= 0) {
    const trackResult =
      packageType === "app"
        ? await trackInAppAction("Exit Intent (Desktop)")
        : await trackWebsiteAction("Exit Intent (Desktop)");

    if (trackResult.ok !== true) {
      return err(trackResult.error);
    }
  }
};

export const addExitIntentListener = (packageType: TJsPackageType): void => {
  if (typeof document !== "undefined" && !exitIntentListenerAdded) {
    document
      .querySelector("body")!
      .addEventListener("mouseleave", (e) => exitIntentListenerWrapper(e, packageType));
    exitIntentListenerAdded = true;
  }
};

export const removeExitIntentListener = (packageType: TJsPackageType): void => {
  if (exitIntentListenerAdded) {
    document.removeEventListener("mouseleave", (e) => exitIntentListenerWrapper(e, packageType));
    exitIntentListenerAdded = false;
  }
};

let scrollDepthListenerAdded = false;
let scrollDepthTriggered = false;

let scrollDepthListenerWrapper = async (packageType: TJsPackageType) => {
  const scrollPosition = window.scrollY;
  const windowSize = window.innerHeight;
  const bodyHeight = document.documentElement.scrollHeight;
  if (scrollPosition === 0) {
    scrollDepthTriggered = false;
  }
  if (!scrollDepthTriggered && scrollPosition / (bodyHeight - windowSize) >= 0.5) {
    scrollDepthTriggered = true;
    const trackResult =
      packageType === "app" ? await trackInAppAction("50% Scroll") : await trackWebsiteAction("50% Scroll");
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
