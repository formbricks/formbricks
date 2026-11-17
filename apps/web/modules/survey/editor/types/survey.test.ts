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
  // ENG-7127: unknown keys used to pass through to `updateSurveyInternal`, where Prisma took them as
  // relation writes and foreign keys outside the survey.
  test("strips keys a survey does not have, relation writes and foreign keys included", () => {
    const parsed = ZSurveyDraft.safeParse(
      draft({
        responses: { connect: [{ id: "clx000000000000000000001" }] },
        segmentId: "clx000000000000000000002",
        workspace: { update: { name: "x" } },
        creator: { update: { email: "x@example.com" } },
        owner: { update: { email: "x@example.com" } },
        displays: { deleteMany: {} },
        somethingTheEditorAdded: 1,
      })
    );

    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.data!).sort()).toEqual(["id", "name", "status", "type"]);
  });

  // Still a draft schema: the survey's own fields pass unchecked, so an incomplete draft saves.
  test("keeps a survey's own fields without checking them", () => {
    const welcomeCard = { enabled: "not-a-boolean" };
    const parsed = ZSurveyDraft.safeParse(draft({ welcomeCard, displayOption: "anything", languages: [{}] }));

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ welcomeCard, displayOption: "anything", languages: [{}] });
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
