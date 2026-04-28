import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { renderEmbedSurveyPreviewEmail } from "@formbricks/email";
import { exampleData } from "@formbricks/email/src/lib/example-data";
import { embedSurveyPreviewEmailHtml } from "@formbricks/email/src/lib/fixtures/embed-survey-preview-email-html";
import { t as mockT } from "@formbricks/email/src/lib/mock-translate";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { extractEmailBodyFragment } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplateFragment";
import { getPreviewEmailTemplateHtml } from "@/modules/email/components/preview-email-template";
import {
  EMBED_SURVEY_PREVIEW_ADDRESS_PLACEHOLDERS,
  EMBED_SURVEY_PREVIEW_CHOICE_IDS,
  EMBED_SURVEY_PREVIEW_CONTACT_PLACEHOLDERS,
  EMBED_SURVEY_PREVIEW_CTA_URL,
  EMBED_SURVEY_PREVIEW_HEADLINE,
  EMBED_SURVEY_PREVIEW_LOCALE,
  EMBED_SURVEY_PREVIEW_MATRIX_COLUMNS,
  EMBED_SURVEY_PREVIEW_MATRIX_ROWS,
  EMBED_SURVEY_PREVIEW_OPEN_TEXT_PLACEHOLDER,
  EMBED_SURVEY_PREVIEW_PICTURE_CHOICES,
  EMBED_SURVEY_PREVIEW_QUESTION_ID,
  EMBED_SURVEY_PREVIEW_STYLING,
  EMBED_SURVEY_PREVIEW_SURVEY_URL,
  createEmbedSurveyPreviewEmailSurvey,
} from "@/modules/email/fixtures/embed-survey-preview-email-fixture";

const mockPreviewT = mockT as unknown as TFunction;

const normalizeStyleAttribute = (style: string) =>
  style
    .split(";")
    .map((declaration) => declaration.trim().replace(/\s*:\s*/g, ":"))
    .filter(Boolean)
    .sort()
    .join(";");

const normalizeHtml = (html: string) =>
  html
    .replace(
      /style="([^"]*)"/g,
      (_match: string, style: string) => `style="${normalizeStyleAttribute(style)}"`
    )
    .replace(/\s+/g, " ")
    .replace(/\s*([:;])\s*/g, "$1")
    .replace(/\s*=\s*/g, "=")
    .replace(/="\s+/g, '="')
    .replace(/>\s+/g, ">")
    .replace(/\s+</g, "<")
    .replace(/\s+>/g, ">")
    .trim();

const decodeSerializedHrefEntities = (html: string) => html.replaceAll("&amp;", "&");

const expectSharedPreviewSignals = (html: string) => {
  expect(html).not.toMatch(/<!DOCTYPE|<html|<head|<body/i);
  expect(html).toContain(EMBED_SURVEY_PREVIEW_HEADLINE);
  expect(html).toContain("skipPrefilled=true");
  expect(html).toContain(
    `${EMBED_SURVEY_PREVIEW_QUESTION_ID}=${encodeURIComponent(EMBED_SURVEY_PREVIEW_CHOICE_IDS.apples)}`
  );
  expect(html).toContain(
    `${EMBED_SURVEY_PREVIEW_QUESTION_ID}=${encodeURIComponent(EMBED_SURVEY_PREVIEW_CHOICE_IDS.bananas)}`
  );
  expect(html).toContain(
    `${EMBED_SURVEY_PREVIEW_QUESTION_ID}=${encodeURIComponent(EMBED_SURVEY_PREVIEW_CHOICE_IDS.pineapples)}`
  );
  expect(html).toContain("utm_source=email_branding");
};

const expectPreviewFragmentBaseSignals = (html: string) => {
  expect(html).not.toMatch(/<!DOCTYPE|<html|<head|<body/i);
  expect(html).toContain(EMBED_SURVEY_PREVIEW_HEADLINE);
};

const runtimeCoverageCases = [
  {
    name: "open text",
    type: TSurveyElementTypeEnum.OpenText,
    expectedTexts: [EMBED_SURVEY_PREVIEW_OPEN_TEXT_PLACEHOLDER],
    expectedHrefFragments: ["preview=true"],
  },
  {
    name: "consent",
    type: TSurveyElementTypeEnum.Consent,
    expectedTexts: ["I agree to be contacted", "Accept", "Reject"],
    expectedHrefFragments: [
      `${EMBED_SURVEY_PREVIEW_QUESTION_ID}=accepted&skipPrefilled=true`,
      `${EMBED_SURVEY_PREVIEW_QUESTION_ID}=dismissed&skipPrefilled=true`,
    ],
  },
  {
    name: "nps",
    type: TSurveyElementTypeEnum.NPS,
    expectedTexts: ["Not likely", "Very likely"],
    expectedHrefFragments: [`${EMBED_SURVEY_PREVIEW_QUESTION_ID}=0&skipPrefilled=true`],
  },
  {
    name: "cta",
    type: TSurveyElementTypeEnum.CTA,
    expectedTexts: ["Open the docs"],
    expectedHrefFragments: [EMBED_SURVEY_PREVIEW_CTA_URL],
  },
  {
    name: "rating",
    type: TSurveyElementTypeEnum.Rating,
    expectedTexts: ["Poor", "Great"],
    expectedHrefFragments: [`${EMBED_SURVEY_PREVIEW_QUESTION_ID}=1&skipPrefilled=true`],
  },
  {
    name: "picture selection",
    type: TSurveyElementTypeEnum.PictureSelection,
    expectedTexts: [],
    expectedHrefFragments: [
      `${EMBED_SURVEY_PREVIEW_QUESTION_ID}=embed-survey-preview-picture-1&skipPrefilled=true`,
      EMBED_SURVEY_PREVIEW_PICTURE_CHOICES[0],
    ],
  },
  {
    name: "cal",
    type: TSurveyElementTypeEnum.Cal,
    expectedTexts: ["Schedule your meeting"],
    expectedHrefFragments: ["preview=true"],
  },
  {
    name: "date",
    type: TSurveyElementTypeEnum.Date,
    expectedTexts: ["Select a date"],
    expectedHrefFragments: ["preview=true"],
  },
  {
    name: "matrix",
    type: TSurveyElementTypeEnum.Matrix,
    expectedTexts: [
      EMBED_SURVEY_PREVIEW_MATRIX_ROWS[0],
      EMBED_SURVEY_PREVIEW_MATRIX_COLUMNS[0],
      "common.continue",
    ],
    expectedHrefFragments: ["preview=true"],
  },
  {
    name: "address",
    type: TSurveyElementTypeEnum.Address,
    expectedTexts: [
      EMBED_SURVEY_PREVIEW_ADDRESS_PLACEHOLDERS.addressLine1,
      EMBED_SURVEY_PREVIEW_ADDRESS_PLACEHOLDERS.city,
      EMBED_SURVEY_PREVIEW_ADDRESS_PLACEHOLDERS.country,
    ],
    expectedHrefFragments: ["preview=true"],
  },
  {
    name: "ranking",
    type: TSurveyElementTypeEnum.Ranking,
    expectedTexts: ["Apples", "Bananas", "Pineapples"],
    expectedHrefFragments: ["preview=true"],
  },
  {
    name: "contact info",
    type: TSurveyElementTypeEnum.ContactInfo,
    expectedTexts: [
      EMBED_SURVEY_PREVIEW_CONTACT_PLACEHOLDERS.firstName,
      EMBED_SURVEY_PREVIEW_CONTACT_PLACEHOLDERS.email,
      EMBED_SURVEY_PREVIEW_CONTACT_PLACEHOLDERS.company,
    ],
    expectedHrefFragments: ["preview=true"],
  },
  {
    name: "file upload",
    type: TSurveyElementTypeEnum.FileUpload,
    expectedTexts: ["Click or drag to upload files."],
    expectedHrefFragments: ["preview=true"],
  },
] as const;

describe("renderEmbedSurveyPreviewEmail", () => {
  test("keeps the checked-in preview fixture aligned with the runtime survey email behaviors", async () => {
    const runtimeHtml = await getPreviewEmailTemplateHtml(
      createEmbedSurveyPreviewEmailSurvey(),
      EMBED_SURVEY_PREVIEW_SURVEY_URL,
      EMBED_SURVEY_PREVIEW_STYLING,
      EMBED_SURVEY_PREVIEW_LOCALE,
      mockPreviewT
    );
    const runtimeFragment = extractEmailBodyFragment(runtimeHtml);

    expectSharedPreviewSignals(runtimeFragment);
    expectSharedPreviewSignals(embedSurveyPreviewEmailHtml);
    expect(runtimeFragment).toContain("font-family:Inter, Helvetica, Arial, sans-serif");
    expect(embedSurveyPreviewEmailHtml).toContain("font-family:Inter, Helvetica, Arial, sans-serif");
    expect(runtimeFragment).toContain("color-scheme:only light");
    expect(embedSurveyPreviewEmailHtml).toContain("color-scheme:only light");
    expect(runtimeFragment).toContain('bgcolor="#4a865f"');
    expect(embedSurveyPreviewEmailHtml).toContain('bgcolor="#4a865f"');
    expect(runtimeFragment).not.toContain('bgcolor="#ffffff"');
    expect(embedSurveyPreviewEmailHtml).not.toContain('bgcolor="#ffffff"');
    expect(runtimeFragment).not.toContain("background-image");
    expect(embedSurveyPreviewEmailHtml).not.toContain("background-image");
    expect(runtimeFragment).toContain("background-color:#ffffff !important");
    expect(embedSurveyPreviewEmailHtml).toContain("background-color:#ffffff !important");
    expect(runtimeFragment).toContain("☐");
    expect(embedSurveyPreviewEmailHtml).toContain("☐");
    expect(normalizeHtml(runtimeFragment)).toBe(normalizeHtml(embedSurveyPreviewEmailHtml));
  });

  test("renders the checked-in survey preview fixture inside the React Email wrapper", async () => {
    const renderedHtml = await renderEmbedSurveyPreviewEmail({
      ...exampleData.embedSurveyPreviewEmail,
      t: mockT,
    });

    expect(exampleData.embedSurveyPreviewEmail.html).toBe(embedSurveyPreviewEmailHtml);
    expect(exampleData.embedSurveyPreviewEmail.html).toContain(EMBED_SURVEY_PREVIEW_HEADLINE);
    expect(exampleData.embedSurveyPreviewEmail.html).toContain("☐");
    expect(exampleData.embedSurveyPreviewEmail.html).toContain("Apples");
    expect(exampleData.embedSurveyPreviewEmail.html).not.toContain("Example Survey Embed");
    expect(exampleData.embedSurveyPreviewEmail.html).not.toMatch(/<!DOCTYPE|<html|<head|<body/i);
    expect(renderedHtml).toContain('name="color-scheme"');
    expect(renderedHtml).toContain('content="only light"');
    expect(renderedHtml).toContain('name="supported-color-schemes"');
    expect(normalizeHtml(renderedHtml)).toContain(normalizeHtml(embedSurveyPreviewEmailHtml));
  });

  test.each(runtimeCoverageCases)(
    "covers the $name preview branch without nested document markup",
    async ({ type, expectedTexts, expectedHrefFragments }) => {
      const html = await getPreviewEmailTemplateHtml(
        createEmbedSurveyPreviewEmailSurvey(type),
        EMBED_SURVEY_PREVIEW_SURVEY_URL,
        EMBED_SURVEY_PREVIEW_STYLING,
        EMBED_SURVEY_PREVIEW_LOCALE,
        mockPreviewT
      );
      const fragment = extractEmailBodyFragment(html);
      const decodedHrefFragment = decodeSerializedHrefEntities(fragment);

      expectPreviewFragmentBaseSignals(fragment);

      for (const expectedText of expectedTexts) {
        expect(fragment).toContain(expectedText);
      }

      for (const expectedHrefFragment of expectedHrefFragments) {
        expect(decodedHrefFragment).toContain(expectedHrefFragment);
      }
    }
  );

  test("uses per-option prefill links for multiple-choice preview emails", async () => {
    const multiChoiceHtml = await getPreviewEmailTemplateHtml(
      createEmbedSurveyPreviewEmailSurvey(TSurveyElementTypeEnum.MultipleChoiceMulti),
      EMBED_SURVEY_PREVIEW_SURVEY_URL,
      EMBED_SURVEY_PREVIEW_STYLING,
      EMBED_SURVEY_PREVIEW_LOCALE,
      mockPreviewT
    );
    const multiChoiceFragment = extractEmailBodyFragment(multiChoiceHtml);

    expect(multiChoiceFragment).toContain(
      `${EMBED_SURVEY_PREVIEW_QUESTION_ID}=${encodeURIComponent(EMBED_SURVEY_PREVIEW_CHOICE_IDS.apples)}`
    );
    expect(multiChoiceFragment).toContain(
      `${EMBED_SURVEY_PREVIEW_QUESTION_ID}=${encodeURIComponent(EMBED_SURVEY_PREVIEW_CHOICE_IDS.bananas)}`
    );
    expect(multiChoiceFragment).toContain(
      `${EMBED_SURVEY_PREVIEW_QUESTION_ID}=${encodeURIComponent(EMBED_SURVEY_PREVIEW_CHOICE_IDS.pineapples)}`
    );
    expect(multiChoiceFragment).toContain("skipPrefilled=true");
    expect(multiChoiceFragment).toContain("☐");
    expect(multiChoiceFragment).not.toMatch(/<a\b[^>]*style="[^"]*width:\s*100%/i);
  });

  test("uses stable encoded choice ids for single-choice prefilling links", async () => {
    const singleChoiceHtml = await getPreviewEmailTemplateHtml(
      createEmbedSurveyPreviewEmailSurvey(TSurveyElementTypeEnum.MultipleChoiceSingle),
      EMBED_SURVEY_PREVIEW_SURVEY_URL,
      EMBED_SURVEY_PREVIEW_STYLING,
      EMBED_SURVEY_PREVIEW_LOCALE,
      mockPreviewT
    );
    const singleChoiceFragment = extractEmailBodyFragment(singleChoiceHtml);

    expect(singleChoiceFragment).toContain(
      `${EMBED_SURVEY_PREVIEW_QUESTION_ID}=${encodeURIComponent(EMBED_SURVEY_PREVIEW_CHOICE_IDS.apples)}`
    );
    expect(singleChoiceFragment).toContain(
      `${EMBED_SURVEY_PREVIEW_QUESTION_ID}=${encodeURIComponent(EMBED_SURVEY_PREVIEW_CHOICE_IDS.bananas)}`
    );
    expect(singleChoiceFragment).toContain(
      `${EMBED_SURVEY_PREVIEW_QUESTION_ID}=${encodeURIComponent(EMBED_SURVEY_PREVIEW_CHOICE_IDS.pineapples)}`
    );
    expect(singleChoiceFragment).toContain("skipPrefilled=true");
    expect(singleChoiceFragment).toContain("◯");
  });
});
