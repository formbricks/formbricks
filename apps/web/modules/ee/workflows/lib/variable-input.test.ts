import { describe, expect, test } from "vitest";
import type { TEditorRecallSource } from "@/modules/ui/components/editor/components/recall-source";
import { withEveryRecallTokenKept } from "./variable-input";

const variableSource: TEditorRecallSource = {
  getRecallItems: (text) =>
    text.includes("#recall:payload.customer.id/")
      ? [{ id: "payload.customer.id", label: "customer.id", type: "variable" }]
      : [],
  getRecallItemLabel: () => undefined,
  renderPicker: () => null,
};

describe("withEveryRecallTokenKept", () => {
  test("keeps the source's items and labels", () => {
    const source = withEveryRecallTokenKept(variableSource);

    expect(source.getRecallItems("id=#recall:payload.customer.id/fallback:#")).toEqual([
      { id: "payload.customer.id", label: "customer.id", type: "variable" },
    ]);
  });

  test("a complete token the source can't name still gets an item named after its id", () => {
    const source = withEveryRecallTokenKept(variableSource);

    expect(
      source.getRecallItems("#recall:payload.customer.id/fallback:# and #recall:abc123/fallback:x#")
    ).toEqual([
      { id: "payload.customer.id", label: "customer.id", type: "variable" },
      { id: "abc123", label: "abc123", type: "variable" },
    ]);
  });

  test("a half-typed token stays text", () => {
    const source = withEveryRecallTokenKept(variableSource);

    expect(source.getRecallItems("#recall:abc123/fallback:x")).toEqual([]);
  });
});
