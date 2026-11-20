import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { LinkSurveyNotFound } from "./not-found";

/** Render the way Next streams a server component, async children included. */
const renderToHtml = async (node: ReactNode): Promise<string> => {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
};

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: vi.fn(async () => (key: string) => `t(${key})`),
}));

describe("LinkSurveyNotFound", () => {
  test("renders its heading and description through t(), so respondents read them in their language", async () => {
    const html = await renderToHtml(<LinkSurveyNotFound />);

    expect(html).toContain("t(s.survey_not_found)");
    expect(html).toContain("t(s.survey_not_found_description)");
    expect(html).not.toContain("Survey not found.");
    expect(html).not.toContain("There is no survey with this ID.");
  });

  test("offers no link back to the dashboard", async () => {
    const html = await renderToHtml(<LinkSurveyNotFound />);

    expect(html).not.toContain("<a");
  });
});
