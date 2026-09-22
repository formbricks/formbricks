import { describe, expect, test } from "vitest";
import { ZSurveyDraft } from "./survey";

const draft = (overrides: Record<string, unknown> = {}) => ({
  id: "clx000000000000000000000",
  status: "draft",
  type: "link",
  name: "My survey",
  ...overrides,
});

describe("ZSurveyDraft", () => {
  test("keeps passing unknown keys through, which is what makes it a draft schema", () => {
    const parsed = ZSurveyDraft.safeParse(draft({ somethingTheEditorAdded: 1 }));

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ somethingTheEditorAdded: 1 });
  });

  test("accepts a well-formed row list", () => {
    const parsed = ZSurveyDraft.safeParse(
      draft({
        embeddedFields: [
          {
            field: {
              name: "plan",
              source: "ingested",
              dataType: "string",
              defaultValue: null,
              locked: false,
              key: null,
            },
            link: { storageKey: "plan" },
          },
        ],
      })
    );

    expect(parsed.success).toBe(true);
  });

  // ENG-2628. `embeddedFields` used to be stripped from this payload before it reached the service,
  // so its shape never mattered here. It is forwarded now, and `updateSurveyInternal` maps it
  // regardless of `skipValidation` — so a value this schema lets through is one the mapper throws
  // on, turning a bad request into a 500.
  test.each([
    ["a bare string", "nope"],
    ["an entry missing its link", [{ field: { name: "plan" } }]],
    ["an empty entry", [{}]],
  ])("refuses %s", (_case, embeddedFields) => {
    expect(ZSurveyDraft.safeParse(draft({ embeddedFields })).success).toBe(false);
  });
});
