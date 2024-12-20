export const verifyTurnstileToken = async (secretKey: string, token: string): Promise<boolean> => {
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      secret: secretKey,
      response: token,
    }),
  });

  const data = await response.json();
  return data.success === true;
};
