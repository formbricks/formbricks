import { describe, expect, test } from "vitest";
import type { TV3CreateSurveyRequestBody } from "@/app/api/v3/surveys/schemas";
import {
  EMPTY_AI_DRAFT,
  mergeAiDraftSnapshot,
} from "@/modules/survey/components/template-list/lib/ai-draft-reducer";
import { payloadToDraftSnapshot } from "./payload-to-draft";

const payload = (body: Record<string, unknown>) => body as unknown as TV3CreateSurveyRequestBody;

/** Through the reducer the review list uses, so the test sees the rows a user would. */
const rowsFor = (body: Record<string, unknown>) =>
  mergeAiDraftSnapshot(EMPTY_AI_DRAFT, payloadToDraftSnapshot(payload(body))).questions;

describe("payloadToDraftSnapshot", () => {
  test("shows each question's default-language text, without the editor's HTML", () => {
    const rows = rowsFor({
      name: "Umfrage (imported)",
      defaultLanguage: "de-DE",
      blocks: [
        {
          name: "Seite 1",
          elements: [
            {
              type: "openText",
              headline: { "en-US": "<p>How was it?</p>", "de-DE": "<p><b>Wie</b> war es?</p>" },
            },
          ],
        },
      ],
    });

    expect(rows).toMatchObject([{ type: "openText", headline: "Wie war es?", blockName: "Seite 1" }]);
  });

  test("falls back to the default key, then to the first language", () => {
    const rows = rowsFor({
      blocks: [
        {
          name: "B",
          elements: [
            { type: "openText", headline: { fr: "Bonjour", default: "Hello" } },
            { type: "openText", headline: { fr: "Bonjour" } },
          ],
        },
      ],
    });

    expect(rows.map((row) => row.headline)).toEqual(["Hello", "Bonjour"]);
  });

  test("counts choices, and a matrix's rows, as the row's options", () => {
    const rows = rowsFor({
      blocks: [
        {
          name: "B",
          elements: [
            { type: "multipleChoiceSingle", headline: { "en-US": "Pick" }, choices: [{}, {}, {}] },
            { type: "matrix", headline: { "en-US": "Rate" }, rows: [{}, {}], columns: [{}, {}, {}] },
          ],
        },
      ],
    });

    expect(rows.map((row) => row.choiceCount)).toEqual([3, 2]);
  });

  test("keeps every block and question in order, numbering rows across blocks", () => {
    const rows = rowsFor({
      blocks: [
        { name: "One", elements: [{ type: "nps", headline: { "en-US": "A" } }] },
        {
          name: "Two",
          elements: [
            { type: "nps", headline: { "en-US": "B" } },
            { type: "nps", headline: { "en-US": "C" } },
          ],
        },
      ],
    });

    expect(rows.map((row) => [row.key, row.blockName, row.headline])).toEqual([
      ["0:0", "One", "A"],
      ["1:0", "Two", "B"],
      ["1:1", "Two", "C"],
    ]);
  });

  test("shows a recall as the editor does: @ and what it recalls", () => {
    const rows = rowsFor({
      defaultLanguage: "en-US",
      blocks: [
        {
          name: "B",
          elements: [
            { id: "Q1", type: "openText", headline: { "en-US": "<p>What is your <b>name</b>?</p>" } },
            {
              id: "Q2",
              type: "openText",
              headline: {
                "en-US": "Thanks #recall:Q1/fallback:...#, from #recall:store_name/fallback:...#!",
              },
            },
            { id: "Q3", type: "openText", headline: { "en-US": "You said: #recall:Q2/fallback:...#" } },
          ],
        },
      ],
    });

    expect(rows.map((row) => row.headline)).toEqual([
      "What is your name?",
      "Thanks @What is your name?, from @store_name!",
      "You said: @Thanks ___, from ___!",
    ]);
  });

  test("tolerates a payload with nothing in it", () => {
    expect(rowsFor({})).toEqual([]);
  });
});
