import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { GET } from "./route";

// Renders through the real next/og rasterizer: the defect only shows once the SVG is parsed.
const renderOgImage = async (
  brandColor?: string,
  name: string | null = "Customer feedback"
): Promise<Buffer> => {
  const url = new URL("http://localhost/api/v1/client/og");
  if (brandColor !== undefined) url.searchParams.set("brandColor", brandColor);
  if (name !== null) url.searchParams.set("name", name);
  const response = await GET(new NextRequest(url));
  return Buffer.from(await response.arrayBuffer());
};

describe("GET /api/v1/client/og", () => {
  test("renders the default image when brandColor carries a mangled query string", async () => {
    // Production shape: a preview fetcher escaped the `&`, so the rest of the query landed in brandColor.
    const image = await renderOgImage('#58d7a5&name=Willkommen bei "Matchworking" | Formbricks');

    expect(image.equals(await renderOgImage())).toBe(true);
  }, 30_000);

  test.each([
    ["an attribute injection", '#000" opacity="0'],
    ["markup", "<rect/>"],
    ["a bare ampersand", "#000&"],
  ])(
    "ignores a brandColor containing %s",
    async (_label, brandColor) => {
      const image = await renderOgImage(brandColor);

      expect(image.equals(await renderOgImage())).toBe(true);
    },
    30_000
  );

  test("renders a valid brand color, treating shorthand and case like the full form", async () => {
    const full = await renderOgImage("#aabbcc");

    expect(full.equals(await renderOgImage())).toBe(false);
    expect((await renderOgImage("#ABC")).equals(full)).toBe(true);
  }, 30_000);
});

describe("right-to-left survey names", () => {
  /**
   * Arabic needing required-ligature substitution threw inside the response stream and poisoned the
   * shared font store on the way out, so these fail outright against the old code.
   */
  test.each([
    ["arabic with lam+alef", "أهلا | Formbricks"],
    ["arabic without lam+alef", "استبياني"],
    ["hebrew", "הסקר שלי"],
  ])(
    "renders an image for %s instead of throwing",
    async (_label, name) => {
      await expect(renderOgImage(undefined, name)).resolves.toBeInstanceOf(Buffer);
    },
    30_000
  );

  test("leaves the title off the card", async () => {
    const untitled = await renderOgImage(undefined, null);

    expect((await renderOgImage(undefined, "أهلا")).equals(untitled)).toBe(true);
  }, 30_000);

  test("keeps the left-to-right segments of a mixed name", async () => {
    const brandOnly = await renderOgImage(undefined, "Formbricks");

    expect((await renderOgImage(undefined, "أهلا | Formbricks")).equals(brandOnly)).toBe(true);
  }, 30_000);

  test("still draws the title for a left-to-right name", async () => {
    const untitled = await renderOgImage(undefined, null);

    expect((await renderOgImage(undefined, "My Survey")).equals(untitled)).toBe(false);
  }, 30_000);
});
