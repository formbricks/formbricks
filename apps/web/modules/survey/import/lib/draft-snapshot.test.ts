import { describe, expect, test } from "vitest";
import { documentToDraftSnapshot } from "./draft-snapshot";

describe("documentToDraftSnapshot", () => {
  test("projects blocks and elements onto the review-list shape, default language first", () => {
    const snapshot = documentToDraftSnapshot({
      name: "Produktfeedback",
      defaultLanguage: "de-DE",
      blocks: [
        {
          name: "Basics",
          elements: [
            { id: "q1", type: "openText", headline: { "en-US": "Why?", "de-DE": "Warum?" } },
            {
              id: "q2",
              type: "multipleChoiceSingle",
              headline: { "de-DE": "Was?" },
              choices: [{ id: "a" }, { id: "b" }],
            },
            {
              id: "q3",
              type: "matrix",
              headline: { "de-DE": "Grid" },
              rows: [{ id: "r" }],
              columns: [{ id: "c" }],
            },
          ],
        },
      ],
    });

    expect(snapshot.name).toBe("Produktfeedback");
    const questions = (snapshot.blocks as { questions: Record<string, unknown>[] }[])[0].questions;
    expect(questions[0]).toEqual({
      type: "openText",
      headline: [
        { languageCode: "de-DE", text: "Warum?" },
        { languageCode: "en-US", text: "Why?" },
      ],
    });
    expect(questions[1]).toEqual({ type: "multipleChoiceSingle", headline: "Was?", choices: ["", ""] });
    expect(questions[2]).toMatchObject({ type: "matrix", choices: [""] });
  });

  test("tolerates malformed input", () => {
    expect(documentToDraftSnapshot({})).toEqual({ name: undefined, blocks: [] });
    const snapshot = documentToDraftSnapshot({ blocks: ["nope", { elements: [1] }] });
    expect((snapshot.blocks as unknown[]).length).toBe(2);
  });

  test("strips editor HTML from headlines so the list shows the words", () => {
    const snapshot = documentToDraftSnapshot({
      name: "Rich",
      defaultLanguage: "en-US",
      blocks: [
        {
          name: "B",
          elements: [
            {
              type: "openText",
              headline: {
                "en-US":
                  '<p class="fb-editor-paragraph"><span style="">What would you like to know?</span></p>',
                "de-DE": "<p>Was möchtest du wissen &amp; mehr?</p>",
              },
            },
          ],
        },
      ],
    });

    expect(snapshot.blocks?.[0]?.questions?.[0]?.headline).toEqual([
      { languageCode: "en-US", text: "What would you like to know?" },
      { languageCode: "de-DE", text: "Was möchtest du wissen & mehr?" },
    ]);
  });
});
