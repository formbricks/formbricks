import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely requests form submission with validation.
 * Provides a fallback for browsers that don't support requestSubmit() (iOS Safari < 16.0).
 * @param form The form element to submit
 */
export function safeFormRequestSubmit(form: HTMLFormElement): void {
  // Check if requestSubmit is supported (iOS Safari 16.0+, all modern browsers)
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    // Fallback for older browsers (iOS Safari < 16.0)
    // reportValidity() triggers native validation UI
    if (!form.reportValidity()) {
      return;
    }
    // Dispatch submit event manually to trigger form submission handlers
    const submitEvent = new Event("submit", {
      bubbles: true,
      cancelable: true,
    });
    form.dispatchEvent(submitEvent);
  }
}
