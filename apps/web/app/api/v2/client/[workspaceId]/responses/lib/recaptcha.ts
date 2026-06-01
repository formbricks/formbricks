import { logger } from "@formbricks/logger";
import { RECAPTCHA_SECRET_KEY, RECAPTCHA_SITE_KEY } from "@/lib/constants";

/**
 * Verifies a reCAPTCHA token with Google's reCAPTCHA API
 * @param token The reCAPTCHA token to verify
 * @param threshold The minimum score threshold (0.0 to 1.0)
 * @returns A promise that resolves to true if the verification is successful and the score meets the threshold, false otherwise
 */
export const verifyRecaptchaToken = async (token: string, threshold: number): Promise<boolean> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    // Fail closed when keys aren't configured: a survey opted into reCAPTCHA
    // must not silently bypass spam protection because the server is misconfigured.
    if (!RECAPTCHA_SITE_KEY || !RECAPTCHA_SECRET_KEY) {
      logger.error(
        "reCAPTCHA verification rejected: RECAPTCHA_SITE_KEY and/or RECAPTCHA_SECRET_KEY are not configured. Set both env vars or disable reCAPTCHA on the survey."
      );
      return false;
    }

    // Build URL-encoded form data
    const params = new URLSearchParams();
    params.append("secret", RECAPTCHA_SECRET_KEY);
    params.append("response", token);

    // POST to Google’s siteverify endpoint
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.error(`reCAPTCHA HTTP error: ${response.status}`);
      return false;
    }

    const data = await response.json();

    // Check if verification was successful
    if (!data.success) {
      logger.error(data, "reCAPTCHA verification failed");
      return false;
    }

    // Check if the score meets the threshold
    if (data.score !== undefined && data.score < threshold) {
      logger.error(data, "reCAPTCHA score below threshold");
      return false;
    }

    return true;
  } catch (error) {
    logger.error(error, "Error verifying reCAPTCHA token");
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
};
