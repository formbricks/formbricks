export const getCSPHeaderValues = () => {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = `
      default-src 'self';
      script-src 'self';
      style-src 'self';
      img-src 'self' blob: data:;
      font-src 'self';
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  return { nonce, cspHeader };
};
