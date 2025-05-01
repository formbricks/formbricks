import { RECAPTCHA_SCRIPT_ID } from "@/lib/common/constants";
import { Logger } from "./logger";

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void | Promise<void>) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render: (container: string | HTMLElement) => number;
      getResponse: (widgetId: number) => string;
      reset: (widgetId?: number) => void;
    };
  }
}

/**
 * Loads the Google reCAPTCHA script if not already loaded
 * @returns A promise that resolves when the script is loaded
 */
export const loadRecaptchaScript = (recaptchaSiteKey?: string): Promise<void> => {
  const logger = Logger.getInstance();

  return new Promise((resolve, reject) => {
    // Check if script already exists
    if (document.getElementById(RECAPTCHA_SCRIPT_ID)) {
      logger.debug("reCAPTCHA script already loaded");
      resolve();
      return;
    }

    // Check if site key is available
    if (!recaptchaSiteKey) {
      logger.debug("reCAPTCHA site key not found");
      reject(new Error("reCAPTCHA site key not found"));
      return;
    }

    // Create script element
    const script = document.createElement("script");
    script.id = RECAPTCHA_SCRIPT_ID;
    script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
    script.async = true;
    script.defer = true;

    // Handle load/error events
    script.onload = () => {
      logger.debug("reCAPTCHA script loaded successfully");
      resolve();
    };
    script.onerror = () => {
      logger.debug("Error loading reCAPTCHA script:");
      reject(new Error("Error loading reCAPTCHA script"));
    };

    // Add script to document
    document.head.appendChild(script);
  });
};

/**
 * Executes reCAPTCHA verification and returns the token
 * @param action - The action name for reCAPTCHA (default: "submit_response")
 * @returns A promise that resolves to the token or undefined
 */
export const executeRecaptcha = async (
  recaptchaSiteKey?: string,
  action = "submit_response"
): Promise<string | null> => {
  const logger = Logger.getInstance();

  if (!recaptchaSiteKey) {
    logger.debug("reCAPTCHA site key not found");
    return null;
  }

  try {
    await loadRecaptchaScript(recaptchaSiteKey);

    // Check if grecaptcha is available
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- grecaptcha is a global variable and may not be defined
    if (!window.grecaptcha) {
      logger.debug("reCAPTCHA API not available");
      return null;
    }

    return await new Promise<string>((resolve, reject) => {
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(recaptchaSiteKey, { action });
          resolve(token);
        } catch (error) {
          reject(new Error(String(error)));
        }
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.debug(`Error during reCAPTCHA execution: ${message}`);
    return null;
  }
};
