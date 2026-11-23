import { describe, expect, test } from "vitest";
import type { TWorkflowSendEmailActionConfig } from "@formbricks/workflows";
import {
  followSurveyLinkChip,
  getSurveyLinkMappingRows,
  hasUnplacedSurveyLink,
  removeSurveyLinkToken,
  setEmbeddedDataValue,
  suggestVariableForField,
  toVariableToken,
  withoutSurveyLink,
} from "./email-survey-link";
import type { TWorkflowVariableOption } from "./variable-picker";

const config = {
  to: "",
  from: "team@example.com",
  replyTo: [],
  subject: "How was your call?",
  body: "<p>Hi, thanks for calling.</p>",
  attachResponseData: false,
} as TWorkflowSendEmailActionConfig;

const option = (path: string, label: string, isPickable = true): TWorkflowVariableOption => ({
  path,
  label,
  typeHint: "text",
  isPickable,
});

describe("survey link token", () => {
  test("is taken out of the body with its paragraph", () => {
    expect(removeSurveyLinkToken("<p>Hi</p><p>#survey-link#</p>")).toBe("<p>Hi</p>");
    expect(removeSurveyLinkToken("<p>Answer here: #survey-link#</p>")).toBe("<p>Answer here: </p>");
    expect(
      removeSurveyLinkToken(
        '<p class="fb-editor-paragraph">Hi</p><p class="fb-editor-paragraph">#survey-link#</p>'
      )
    ).toBe('<p class="fb-editor-paragraph">Hi</p>');
  });

  test("removing the link removes its token too", () => {
    expect(
      withoutSurveyLink({
        ...config,
        body: "<p>Hi</p><p>#survey-link#</p>",
        surveyLink: { surveyId: "s1", embeddedData: [] },
      })
    ).toEqual({ surveyLink: undefined, body: "<p>Hi</p>" });
  });
});

describe("followSurveyLinkChip", () => {
  const link = { surveyId: "s1", embeddedData: [{ key: "plan", value: "#recall:payload.plan/fallback:#" }] };
  const withChip = "<p>Hi</p><p>#survey-link#</p>";

  test("deleting the chip as text removes the link with it", () => {
    const patch = followSurveyLinkChip({ body: withChip, surveyLink: link }, "<p>Hi</p>");

    expect(patch).toEqual({ body: "<p>Hi</p>", surveyLink: undefined });
    expect(hasUnplacedSurveyLink(patch)).toBe(false);
  });

  test("typing elsewhere changes only the body", () => {
    expect(
      followSurveyLinkChip({ body: withChip, surveyLink: link }, "<p>Hi there</p><p>#survey-link#</p>")
    ).toEqual({ body: "<p>Hi there</p><p>#survey-link#</p>" });
  });

  test("inserting a new link's chip keeps the link set just before it", () => {
    expect(followSurveyLinkChip({ body: "<p>Hi</p>", surveyLink: link }, withChip)).toEqual({
      body: withChip,
    });
  });

  test("leaves a link that was never in the body for the problem to point out", () => {
    const config = { body: "<p>Hi</p>", surveyLink: link };
    expect(followSurveyLinkChip(config, "<p>Hi!</p>")).toEqual({ body: "<p>Hi!</p>" });
    expect(hasUnplacedSurveyLink(config)).toBe(true);
  });
});

describe("setEmbeddedDataValue", () => {
  const rows = [
    { key: "a", value: "1" },
    { key: "b", value: "2" },
  ];

  test("changes a field's value in place", () => {
    expect(setEmbeddedDataValue(rows, "b", "#recall:payload.b/fallback:#")).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "#recall:payload.b/fallback:#" },
    ]);
  });

  test("adds a field that had no value", () => {
    expect(setEmbeddedDataValue(rows, "c", "3")).toEqual([...rows, { key: "c", value: "3" }]);
  });

  test("a blank value takes the field off the link", () => {
    expect(setEmbeddedDataValue(rows, "a", "  ")).toEqual([{ key: "b", value: "2" }]);
  });
});

describe("getSurveyLinkMappingRows", () => {
  const fields = [
    { key: "customer_id", name: "Customer ID", dataType: "string" as const },
    { key: "plan", name: "plan", dataType: "string" as const },
  ];

  test("lists every field the link can set, then saved keys the survey doesn't take", () => {
    expect(
      getSurveyLinkMappingRows(fields, [
        { key: "old_key", value: "x" },
        { key: "plan", value: "#recall:payload.plan/fallback:#" },
      ])
    ).toEqual([
      { key: "customer_id", name: "Customer ID", value: "", isTaken: true },
      { key: "plan", name: "plan", value: "#recall:payload.plan/fallback:#", isTaken: true },
      { key: "old_key", name: "old_key", value: "x", isTaken: false },
    ]);
  });

  test("without the survey's fields, shows only the saved keys and doesn't call them unknown", () => {
    expect(getSurveyLinkMappingRows(null, [{ key: "old_key", value: "x" }])).toEqual([
      { key: "old_key", name: "old_key", value: "x", isTaken: true },
    ]);
  });
});

describe("suggestVariableForField", () => {
  test("matches a field key to the end of a Variable's path, ignoring case and separators", () => {
    const options = [
      option("payload.customer.name", "customer.name"),
      option("payload.customer.id", "customer.id"),
    ];
    expect(suggestVariableForField({ key: "customer_id", name: "Customer ID" }, options)?.path).toBe(
      "payload.customer.id"
    );
  });

  test("matches a step output by its name, without the step id", () => {
    expect(
      suggestVariableForField({ key: "owner-email", name: "Owner" }, [
        option("steps.http1.owner.email", "owner.email"),
      ])?.path
    ).toBe("steps.http1.owner.email");
  });

  test("matches a response field by its label", () => {
    expect(
      suggestVariableForField({ key: "x1y2", name: "Account tier" }, [option("response.x9", "Account tier")])
        ?.path
    ).toBe("response.x9");
  });

  test("prefers the Variable whose whole name matches over a partial one", () => {
    const options = [option("payload.customer.id", "customer.id"), option("payload.id", "id")];
    expect(suggestVariableForField({ key: "id", name: "id" }, options)?.path).toBe("payload.id");
  });

  test("never suggests a Variable that can't be picked, nor one that doesn't match", () => {
    expect(
      suggestVariableForField({ key: "items", name: "items" }, [option("payload.items", "items", false)])
    ).toBeNull();
    expect(
      suggestVariableForField({ key: "plan", name: "plan" }, [option("payload.tier", "tier")])
    ).toBeNull();
  });
});

test("toVariableToken writes a Variable as the @ picker does", () => {
  expect(toVariableToken("payload.customer.id")).toBe("#recall:payload.customer.id/fallback:#");
});
