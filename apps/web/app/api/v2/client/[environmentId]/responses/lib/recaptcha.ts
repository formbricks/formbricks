import { RECAPTCHA_SECRET_KEY, RECAPTCHA_SITE_KEY } from "@/lib/constants";
import { logger } from "@formbricks/logger";

/**
 * Verifies a reCAPTCHA token with Google's reCAPTCHA API
 * @param token The reCAPTCHA token to verify
 * @param threshold The minimum score threshold (0.0 to 1.0)
 * @param siteKey Optional custom site key to use (overrides env variable)
 * @returns true if verification is successful, throws an error otherwise
 */
export const verifyRecaptchaToken = async (
  token: string,
  threshold: number = 0.5,
  siteKey?: string
): Promise<boolean> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const recaptchaSiteKey = siteKey || RECAPTCHA_SITE_KEY;
    const recaptchaSecretKey = RECAPTCHA_SECRET_KEY;

    if (!recaptchaSiteKey || !recaptchaSecretKey) {
      logger.warn("reCAPTCHA verification skipped: site key or secret key not configured");
      return true;
    }
    // Verify the token with Google's reCAPTCHA API
    const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=${recaptchaSecretKey}&response=${token}`,
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();

    // Check if verification was successful
    if (!data.success) {
      logger.error(data, "reCAPTCHA verification failed");
      return false;
    }

    // Check if the score meets the threshold
    if (data.score !== undefined && data.score <= threshold) {
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
