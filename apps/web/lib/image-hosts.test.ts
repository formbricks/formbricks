import { type StaticImageData } from "next/image";
import { describe, expect, test } from "vitest";
import { OPTIMIZABLE_IMAGE_HOSTS, isExternalImageSrc } from "./image-hosts";

describe("isExternalImageSrc", () => {
  test("treats relative first-party paths as optimizable (not external)", () => {
    expect(isExternalImageSrc("/storage/ws/public/logo.png")).toBe(false);
    expect(isExternalImageSrc("/images/hero.png")).toBe(false);
  });

  test("treats data URIs as optimizable (not external)", () => {
    expect(isExternalImageSrc("data:image/png;base64,iVBORw0KGgo=")).toBe(false);
  });

  test("treats nullish / non-string (StaticImageData) srcs as not external", () => {
    expect(isExternalImageSrc(undefined)).toBe(false);
    expect(isExternalImageSrc(null)).toBe(false);
    expect(isExternalImageSrc("")).toBe(false);
    expect(isExternalImageSrc({ src: "/x.png", height: 1, width: 1 } as StaticImageData)).toBe(false);
  });

  test("treats absolute URLs on allowlisted provider/CDN hosts as optimizable", () => {
    expect(isExternalImageSrc("https://images.unsplash.com/photo-1.jpg")).toBe(false);
    expect(isExternalImageSrc("https://formbricks-cdn.s3.eu-central-1.amazonaws.com/x.png")).toBe(false);
    expect(isExternalImageSrc("https://avatars.githubusercontent.com/u/1")).toBe(false);
  });

  test("treats arbitrary external URLs as external (must bypass the optimizer)", () => {
    expect(isExternalImageSrc("https://evil.example.com/x.png")).toBe(true);
    expect(isExternalImageSrc("http://random-host.test/logo.svg")).toBe(true);
  });

  test("treats an absolute URL to the deployment's own domain as external (relative is the supported first-party form)", () => {
    // The running domain is intentionally not in the allowlist; first-party images must be relative.
    expect(isExternalImageSrc("https://app.formbricks.com/storage/ws/public/logo.png")).toBe(true);
    expect(isExternalImageSrc("https://survey.company.com/storage/ws/public/logo.png")).toBe(true);
  });

  test("does not include the deployment domain in the optimizable host allowlist", () => {
    expect(OPTIMIZABLE_IMAGE_HOSTS).not.toContain("app.formbricks.com");
  });
});
