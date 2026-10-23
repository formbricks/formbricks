import { describe, expect, test, vi } from "vitest";
import { prepareV3SurveyCreateInput } from "@/app/api/v3/surveys/prepare";
import type { TQsfDraftDocument } from "./assemble";
import { checkQsfDraft, checkQsfDraftInSlices, elementsAtFault } from "./final-gate";

const draft = (elements: unknown[], extra: Partial<TQsfDraftDocument> = {}): TQsfDraftDocument =>
  ({
    workspaceId: "clxx1234567890123456789012",
    name: "Draft",
    type: "link",
    status: "draft",
    defaultLanguage: "en-US",
    languages: [{ code: "en-US", default: true, enabled: true }],
    blocks: [{ id: "clblock000000000000000001", name: "Block 1", elements }],
    endings: [],
    hiddenFields: { enabled: false, fieldIds: [] },
    ...extra,
  }) as TQsfDraftDocument;

const openText = (id: string, headline: string) => ({
  id,
  type: "openText",
  headline: { "en-US": headline },
  required: false,
  isDraft: true,
  inputType: "text",
  longAnswer: false,
  charLimit: { enabled: false },
});

describe("checkQsfDraft", () => {
  test("accepts a draft the create accepts", () => {
    expect(checkQsfDraft(draft([openText("q1", "Hello")]))).toEqual([]);
  });

  test("refuses duplicate choice labels, which the create's preparation alone lets through", () => {
    const document = draft([
      {
        id: "q1",
        type: "multipleChoiceSingle",
        headline: { "en-US": "Pick" },
        required: false,
        isDraft: true,
        choices: [
          { id: "a", label: { "en-US": "N/A" } },
          { id: "b", label: { "en-US": "N/A" } },
        ],
        shuffleOption: "none",
        displayType: "list",
      },
    ]);

    // What the create runs first passes; its later write-schema check would answer 422.
    expect(prepareV3SurveyCreateInput(document).ok).toBe(true);
    expect(checkQsfDraft(document).map((param) => param.name)).toEqual(["blocks.0.elements.0.choices"]);
  });

  test("refuses a forward recall, which the create checks in skip mode", () => {
    const document = draft([openText("q1", "You said #recall:q2/fallback:...#"), openText("q2", "Second")]);

    expect(prepareV3SurveyCreateInput(document).ok).toBe(true);
    expect(checkQsfDraft(document)).toEqual([
      expect.objectContaining({
        name: expect.stringMatching(/^blocks\.0\.elements\.0\./),
        code: "misordered_reference",
      }),
    ]);
  });

  test("refuses an empty headline, as the survey service does", () => {
    expect(checkQsfDraft(draft([openText("q1", " ")])).length).toBeGreaterThan(0);
  });
});

describe("elementsAtFault", () => {
  test("maps each problem to its element", () => {
    expect(
      elementsAtFault([
        { name: "blocks.0.elements.1.choices", reason: "r" },
        { name: "blocks.2.elements.0", reason: "r" },
      ])
    ).toEqual([
      [0, 1],
      [2, 0],
    ]);
  });

  test("gives up when a problem is not about one element", () => {
    expect(
      elementsAtFault([
        { name: "blocks.0.elements.1.choices", reason: "r" },
        { name: "endings.0.label", reason: "r" },
      ])
    ).toBeNull();
    expect(elementsAtFault([{ name: "blocks.0.logic", reason: "r" }])).toBeNull();
  });
});

describe("checkQsfDraftInSlices", () => {
  test("runs the same three checks, yielding between them", async () => {
    const between = vi.fn(async () => undefined);
    const document = draft([openText("q1", "Hello #recall:q2/fallback:...#"), openText("q2", "Later")]);

    expect(await checkQsfDraftInSlices(draft([openText("q1", "Hello")]), between)).toEqual([]);
    expect(between).toHaveBeenCalledTimes(2);
    expect(await checkQsfDraftInSlices(document, async () => undefined)).toEqual(checkQsfDraft(document));
    expect(checkQsfDraft(document)).not.toEqual([]);
  });
});
