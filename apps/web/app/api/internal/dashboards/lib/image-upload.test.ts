import { describe, expect, test, vi } from "vitest";
import { ZDashboardImageUploadBody } from "./image-upload";

vi.mock("@/modules/storage/service", () => ({ getSignedUrlForUpload: vi.fn() }));

describe("ZDashboardImageUploadBody", () => {
  test.each(["logo.png", "logo.JPG", "logo.jpeg", "logo.webp"])("accepts %s", (fileName) => {
    expect(ZDashboardImageUploadBody.safeParse({ fileName }).success).toBe(true);
  });

  // SVG is served from the app's origin unsanitized (an XSS vector), and storage refuses GIF uploads.
  test.each(["logo.svg", "logo.gif", "logo.html", "logo"])("refuses %s", (fileName) => {
    expect(ZDashboardImageUploadBody.safeParse({ fileName }).success).toBe(false);
  });
});
