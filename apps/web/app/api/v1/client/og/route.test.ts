import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { GET } from "./route";

// Renders through the real next/og rasterizer: the defect only shows once the SVG is parsed.
const renderOgImage = async (brandColor?: string): Promise<Buffer> => {
  const url = new URL("http://localhost/api/v1/client/og");
  if (brandColor !== undefined) url.searchParams.set("brandColor", brandColor);
  url.searchParams.set("name", "Customer feedback");
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
