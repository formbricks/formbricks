import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import ContactSurveyNotFound from "./not-found";

/** Render the way Next streams a server component, async children included. */
const renderToHtml = async (node: ReactNode): Promise<string> => {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
};

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: vi.fn(async () => (key: string) => `t(${key})`),
}));

// ENG-3844: `ContactSurveyPage` calls `notFound()` when the survey behind a contact link is missing.
// Without a segment `not-found.tsx`, the respondent got the dashboard's 404 and its "Back to home"
// link to `/`.
describe("/c/[jwt] not-found", () => {
  test("shows the respondent-facing survey-not-found page, not the dashboard 404", async () => {
    const html = await renderToHtml(<ContactSurveyNotFound />);

    expect(html).toContain("t(s.survey_not_found)");
    expect(html).not.toContain("Page not found");
    expect(html).not.toContain('href="/"');
  });
});
