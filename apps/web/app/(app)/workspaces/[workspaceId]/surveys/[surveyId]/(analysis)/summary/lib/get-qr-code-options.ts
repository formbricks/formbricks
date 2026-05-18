import { Options } from "qr-code-styling";

export const getQRCodeOptions = (width: number, height: number): Options => ({
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
