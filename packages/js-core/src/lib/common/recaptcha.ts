/* eslint-disable @typescript-eslint/no-explicit-any -- Google reCAPTCHA types */
import { Config } from "./config";
import { Logger } from "./logger";

// Define a Result type for handling success/errors
export type Result<T, E extends Error = Error> = { ok: true; value: T } | { ok: false; error: E };

// Define a RecaptchaError class for specific error types
export class RecaptchaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecaptchaError";
  }
}

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
    if (document.getElementById("formbricks-recaptcha-script")) {
      logger.debug("reCAPTCHA script already loaded");
      resolve();
      return;
    }

    // Check if site key is available
    if (!recaptchaSiteKey) {
      logger.debug("reCAPTCHA site key not found");
      reject(new RecaptchaError("reCAPTCHA site key not found"));
      return;
    }

    // Create script element
    const script = document.createElement("script");
    script.id = "formbricks-recaptcha-script";
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
      reject(new RecaptchaError("Error loading reCAPTCHA script"));
    };

    // Add script to document
    document.head.appendChild(script);
  });
};

/**
 * Executes reCAPTCHA verification and dispatches a custom event with the token
 * @param action - The action name for reCAPTCHA (default: "submit_response")
 * @returns A promise that resolves when the token is dispatched
 */
export const executeRecaptcha = async (action = "submit_response"): Promise<string | undefined> => {
  const logger = Logger.getInstance();
  const config = Config.getInstance();

  const recaptchaSiteKey = config.get().environment.data.recaptchaSiteKey;
  if (!recaptchaSiteKey) {
    logger.debug("reCAPTCHA site key not found");
    return;
  }

  try {
    await loadRecaptchaScript(recaptchaSiteKey);

    // Check if grecaptcha is available
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- grecaptcha is a global variable and may not be defined
    if (!window.grecaptcha) {
      logger.debug("reCAPTCHA API not available");
      return;
    }

    // Execute reCAPTCHA verification
    // window.grecaptcha.ready(async () => {
    //   try {
    //     const token = await window.grecaptcha.execute(recaptchaSiteKey, { action });
    //     const recaptchaTokenEvent = new CustomEvent("recaptchaToken", {
    //       detail: {
    //         token,
    //         action
    //       }
    //     });
    //     window.dispatchEvent(recaptchaTokenEvent);
    //   } catch (error) {
    //     logger.debug(`Error during reCAPTCHA execution: ${error as string}`);
    //   }
    // });

    const val = await new Promise((resolve, reject) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(recaptchaSiteKey, { action })
          .then((token: string) => {
            const recaptchaTokenEvent = new CustomEvent("recaptchaToken", {
              detail: {
                token,
                action,
              },
            });
            window.dispatchEvent(recaptchaTokenEvent);

            resolve(token);
          })
          .catch((error: unknown) => {
            logger.debug(`Error during reCAPTCHA execution: ${error as string}`);
            reject(new RecaptchaError(`Error during reCAPTCHA execution: ${error as string}`));
          });
      });
    });

    return val as string;
  } catch (error) {
    logger.debug(`Error during reCAPTCHA execution: ${error as string}`);
  }
};
