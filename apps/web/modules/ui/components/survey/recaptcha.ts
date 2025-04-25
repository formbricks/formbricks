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
  return new Promise((resolve, reject) => {
    // Check if script already exists
    if (document.getElementById("formbricks-recaptcha-script")) {
      resolve();
      return;
    }

    // Check if site key is available
    if (!recaptchaSiteKey) {
      reject(new Error("reCAPTCHA site key not found"));
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
      resolve();
    };
    script.onerror = () => {
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
): Promise<string | undefined> => {
  if (!recaptchaSiteKey) {
    return;
  }

  try {
    await loadRecaptchaScript(recaptchaSiteKey);

    // Check if grecaptcha is available
    if (!window.grecaptcha) {
      return;
    }

    const val = await new Promise((resolve, reject) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(recaptchaSiteKey, { action })
          .then((token: string) => {
            resolve(token);
          })
          .catch((error: unknown) => {
            reject(new Error(`Error during reCAPTCHA execution: ${error as string}`));
          });
      });
    });

    return val as string;
  } catch (error) {
    return;
  }
};
