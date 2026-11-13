/** A converted image, base64-encoded. */
export type THeicConversionResource = { image: string; contentType: "image/jpeg" };

export const serializeHeicConversion = (jpeg: ArrayBuffer): THeicConversionResource => ({
  image: Buffer.from(jpeg).toString("base64"),
  contentType: "image/jpeg",
});
