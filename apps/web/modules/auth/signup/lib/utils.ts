import posthog from "posthog-js";

export const verifyTurnstileToken = async (secretKey: string, token: string): Promise<boolean> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Verification failed with status: ${response.status}`);
    }

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const captureFailedSignup = (email: string, name: string) => {
  posthog.capture("TELEMETRY_FAILED_SIGNUP", {
    email,
    name,
  });
};
