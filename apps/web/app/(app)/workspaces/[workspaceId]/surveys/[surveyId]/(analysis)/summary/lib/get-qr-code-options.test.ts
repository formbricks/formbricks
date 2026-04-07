import { describe, expect, test } from "vitest";
import { getQRCodeOptions } from "./get-qr-code-options";

describe("getQRCodeOptions", () => {
  test("should return correct QR code options for given width and height", () => {
    const width = 300;
    const height = 300;
    const options = getQRCodeOptions(width, height);

    expect(options).toEqual({
      width,
      height,
      type: "svg",
      data: "",
      margin: 0,
      qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: "L",
      },
      imageOptions: {
        saveAsBlob: true,
        hideBackgroundDots: false,
        imageSize: 0,
        margin: 0,
      },
      dotsOptions: {
        type: "extra-rounded",
        color: "#000000",
        roundSize: true,
      },
      backgroundOptions: {
        color: "#ffffff",
      },
      cornersSquareOptions: {
        type: "dot",
        color: "#000000",
      },
      cornersDotOptions: {
        type: "dot",
        color: "#000000",
      },
    });
  });

  test("should return correct QR code options for different width and height", () => {
    const width = 150;
    const height = 200;
    const options = getQRCodeOptions(width, height);

    expect(options.width).toBe(width);
    expect(options.height).toBe(height);
    expect(options.type).toBe("svg");
    // Check a few other properties to ensure the structure is consistent
    expect(options.dotsOptions?.type).toBe("extra-rounded");
    expect(options.backgroundOptions?.color).toBe("#ffffff");
  });
});
