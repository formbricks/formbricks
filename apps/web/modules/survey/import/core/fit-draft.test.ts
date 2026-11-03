import { describe, expect, test } from "vitest";
import type { TSurveyImportAssembly, TSurveyImportDraft, TSurveyImportDraftElement } from "./draft";
import { fitDraftToCreateLimit, measureDraftBytes } from "./fit-draft";

const WORKSPACE_ID = "clxx1234567890123456789012";

const element = (id: string, english: string, german?: string): TSurveyImportDraftElement => ({
  id,
  type: "openText",
  headline: german === undefined ? { "en-US": english } : { "en-US": english, "de-DE": german },
  required: false,
  isDraft: true,
  inputType: "text",
  longAnswer: false,
  charLimit: { enabled: false },
});

const assembly = (languages: TSurveyImportDraft["languages"]): TSurveyImportAssembly => ({
  document: {
    workspaceId: WORKSPACE_ID,
    name: "Visitor survey",
    type: "link",
    status: "draft",
    defaultLanguage: "en-US",
    languages,
    ...(languages.length > 1
      ? { welcomeCard: { enabled: true, headline: { "en-US": "Welcome", "de-DE": "Willkommen" } } }
      : {}),
    blocks: [{ id: "block_1", name: "Block 1", elements: [element("q1", "Question one", "Frage eins")] }],
    endings: [
      {
        id: "ending_1",
        type: "endScreen",
        headline: { "en-US": "Thanks", ...(languages.length > 1 ? { "de-DE": "Danke" } : {}) },
      },
    ],
    hiddenFields: { enabled: true, fieldIds: [] },
  },
  issues: [],
  elementRefs: [["R1"]],
});

describe("fitDraftToCreateLimit", () => {
  test("drops a language from the welcome card too, so the draft still passes the create's checks", () => {
    const built = assembly([
      { code: "en-US", default: true, enabled: true },
      { code: "de-DE", default: false, enabled: true },
    ]);

    const { dropped } = fitDraftToCreateLimit(built, () => undefined, measureDraftBytes(built.document) - 1);

    expect(dropped).toContainEqual(
      expect.objectContaining({
        code: "language_skipped",
        params: { code: "de-DE", cause: "draft_too_large", order: "last_declared_first" },
      })
    );
    expect(built.document.welcomeCard?.headline).toEqual({ "en-US": "Welcome" });
  });

  test("retargets a jump to a cut block to the ending, so the create finds its target", () => {
    const built = assembly([{ code: "en-US", default: true, enabled: true }]);
    built.document.blocks.push({ id: "block_2", name: "Block 2", elements: [element("q2", "Question two")] });
    built.elementRefs.push(["R2"]);
    built.document.blocks[0].logic = [
      {
        id: "logic_1",
        conditions: { id: "group_1", connector: "and", conditions: [] },
        actions: [{ id: "action_1", objective: "jumpToBlock", target: "block_2" }],
      },
    ];
    built.document.blocks[0].logicFallback = "block_2";

    // One byte over: the cut removes the last block, and the ending's id a byte longer still fits.
    fitDraftToCreateLimit(built, () => undefined, measureDraftBytes(built.document) - 1);

    expect(built.document.blocks.map((block) => block.id)).toEqual(["block_1"]);
    expect(built.document.blocks[0].logic).toEqual([
      expect.objectContaining({
        actions: [expect.objectContaining({ objective: "jumpToBlock", target: "ending_1" })],
      }),
    ]);
    expect(built.document.blocks[0].logicFallback).toBe("ending_1");
  });
});
