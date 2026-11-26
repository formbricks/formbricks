import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { validateElementLabels } from "@formbricks/types/surveys/elements-validation";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import { validateCardFieldsForAllLanguages } from "@formbricks/types/surveys/validation";
import { describeMissingLabelIssue } from "./missing-label-message";

// Renders the key and its options, so a test sees which sentence was chosen and what filled it.
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key) as unknown as TFunction;

const language = (code: string, isDefault: boolean): TSurveyLanguage => ({
  language: {
    id: code,
    code,
    alias: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspaceId: "workspace",
  },
  default: isDefault,
  enabled: true,
});

const languages = [language("en", true), language("de", false), language("ja", false)];

// The issue as the editor receives it after parsing: a path and, for a custom issue, its params.
const asParsed = (raw: z.core.$ZodRawIssue | null) => {
  if (!raw) throw new Error("expected a label issue");
  return {
    path: raw.path ?? [],
    params: "params" in raw ? (raw.params as Record<string, unknown> | undefined) : undefined,
  };
};

describe("describeMissingLabelIssue", () => {
  test("words the welcome-card issue from the ticket in the editor's locale, languages included", () => {
    const issue = validateCardFieldsForAllLanguages(
      "cardHeadline",
      { default: "Welcome", en: "Welcome", de: "", ja: "" },
      languages,
      "welcome"
    );

    const described = describeMissingLabelIssue(asParsed(issue), t, "pt-PT");

    expect(described).toEqual({
      message: `workspace.surveys.edit.missing_label.on_welcome_card_for_languages ${JSON.stringify({
        field: "common.note",
        languages: "Alemão, Japonês",
      })}`,
      hasLanguageList: true,
    });
  });

  test("words a missing default label on an ending card without a language list", () => {
    const issue = validateCardFieldsForAllLanguages(
      "endingCardButtonLabel",
      { default: "", en: "", de: "", ja: "" },
      languages,
      "end",
      1
    );

    expect(describeMissingLabelIssue(asParsed(issue), t, "en-US")).toEqual({
      message: `workspace.surveys.edit.missing_label.on_ending_card ${JSON.stringify({
        field: "workspace.surveys.edit.button_label",
        endingNumber: 2,
      })}`,
      hasLanguageList: false,
    });
  });

  test("words a missing question headline with its question and block numbers", () => {
    const issue = validateElementLabels("headline", { default: "", en: "", de: "", ja: "" }, languages, 1, 0);

    expect(describeMissingLabelIssue(asParsed(issue), t, "en-US")).toEqual({
      message: `workspace.surveys.edit.missing_label.in_question ${JSON.stringify({
        field: "workspace.surveys.edit.missing_label.question_text",
        questionNumber: 1,
        blockNumber: 2,
      })}`,
      hasLanguageList: false,
    });
  });

  test("names a numbered option from the path the issue was moved to", () => {
    const issue = validateElementLabels(
      "Choice 3",
      { default: "Yes", en: "Yes", de: "Ja", ja: "" },
      languages,
      0,
      2,
      true
    );

    const described = describeMissingLabelIssue(
      { ...asParsed(issue), path: ["blocks", 0, "elements", 2, "choices", 2] },
      t,
      "en-US"
    );

    expect(described?.message).toBe(
      `workspace.surveys.edit.missing_label.in_question_for_languages ${JSON.stringify({
        field: `common.choice_n ${JSON.stringify({ n: 3 })}`,
        questionNumber: 3,
        blockNumber: 1,
        languages: "Japanese",
      })}`
    );
  });

  test("names a picture choice's alt text and a contact-info subfield", () => {
    const altText = describeMissingLabelIssue(
      {
        path: ["blocks", 0, "elements", 0, "choices", 1, "imageAltText"],
        params: { missingLabel: true },
      },
      t,
      "en-US"
    );
    const subfield = describeMissingLabelIssue(
      { path: ["blocks", 0, "elements", 0, "firstname"], params: { missingLabel: true } },
      t,
      "en-US"
    );

    expect(altText?.message).toContain(
      `"field":"workspace.surveys.edit.missing_label.choice_image_alt_text {\\"n\\":2}"`
    );
    expect(subfield?.message).toContain(
      `"field":"workspace.surveys.edit.missing_label.subfield_label {\\"field\\":\\"workspace.surveys.edit.first_name\\"}"`
    );
  });

  test("leaves issues that are not missing-label issues to their own handling", () => {
    expect(
      describeMissingLabelIssue(
        { path: ["welcomeCard", "cardHeadline"], params: { invalidLanguageCodes: ["de"] } },
        t,
        "en-US"
      )
    ).toBeNull();
    expect(describeMissingLabelIssue({ path: ["questions", 0, "headline"] }, t, "en-US")).toBeNull();
  });

  test("leaves a marked issue on the legacy questions path to its own handling", () => {
    expect(
      describeMissingLabelIssue(
        { path: ["questions", 0, "headline"], params: { missingLabel: true } },
        t,
        "en-US"
      )
    ).toBeNull();
  });

  test("lists the languages a translated ending-card label is missing in", () => {
    const issue = validateCardFieldsForAllLanguages(
      "subheader",
      { default: "Thanks", en: "Thanks", de: "", ja: "Arigato" },
      languages,
      "end",
      0
    );

    expect(describeMissingLabelIssue(asParsed(issue), t, "en-US")).toEqual({
      message: `workspace.surveys.edit.missing_label.on_ending_card_for_languages ${JSON.stringify({
        field: "common.description",
        endingNumber: 1,
        languages: "German",
      })}`,
      hasLanguageList: true,
    });
  });

  test.each([
    [["placeholder"], "common.placeholder"],
    [["label"], "workspace.surveys.edit.checkbox_label"],
    [["upperLabel"], "workspace.surveys.edit.upper_label"],
    [["lowerLabel"], "workspace.surveys.edit.lower_label"],
    [["ctaButtonLabel"], "workspace.surveys.edit.button_label"],
    [["imageAltText"], "workspace.surveys.edit.image_alt_text"],
    [["rows", 0], `common.row_n ${JSON.stringify({ n: 1 })}`],
    [["columns", 1], `common.column_n ${JSON.stringify({ n: 2 })}`],
    [
      ["addressline1"],
      `workspace.surveys.edit.missing_label.subfield_label ${JSON.stringify({ field: "workspace.surveys.edit.address_line_1" })}`,
    ],
    [["somethingNew"], "somethingNew"],
  ])("names the question field at %j as %s", (fieldPath, field) => {
    const described = describeMissingLabelIssue(
      { path: ["blocks", 0, "elements", 0, ...fieldPath], params: { missingLabel: true } },
      t,
      "en-US"
    );

    expect(described?.message).toBe(
      `workspace.surveys.edit.missing_label.in_question ${JSON.stringify({ field, questionNumber: 1, blockNumber: 1 })}`
    );
  });

  test("names the welcome card's next button", () => {
    const described = describeMissingLabelIssue(
      { path: ["welcomeCard", "buttonLabel"], params: { missingLabel: true } },
      t,
      "en-US"
    );

    expect(described?.message).toBe(
      `workspace.surveys.edit.missing_label.on_welcome_card ${JSON.stringify({ field: "workspace.surveys.edit.next_button_label" })}`
    );
  });
});
