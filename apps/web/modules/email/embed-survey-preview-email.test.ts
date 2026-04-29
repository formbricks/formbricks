import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { renderEmbedSurveyPreviewEmail } from "@formbricks/email";
import { exampleData } from "@formbricks/email/src/lib/example-data";
import { embedSurveyPreviewEmailHtml } from "@formbricks/email/src/lib/fixtures/embed-survey-preview-email-html";
import { t as mockT } from "@formbricks/email/src/lib/mock-translate";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { extractEmailBodyFragment } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplateFragment";
import { mixColor } from "@/lib/utils/colors";
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

const renderPreviewHtml = (type?: TSurveyElementTypeEnum) =>
  getPreviewEmailTemplateHtml(
    createEmbedSurveyPreviewEmailSurvey(type),
    EMBED_SURVEY_PREVIEW_SURVEY_URL,
    EMBED_SURVEY_PREVIEW_STYLING,
    EMBED_SURVEY_PREVIEW_LOCALE,
    mockPreviewT
  );

const renderPreviewFragment = async (type?: TSurveyElementTypeEnum) =>
  extractEmailBodyFragment(await renderPreviewHtml(type));

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
    expectedTexts: [EMBED_SURVEY_PREVIEW_MATRIX_ROWS[0], EMBED_SURVEY_PREVIEW_MATRIX_COLUMNS[0], "Continue"],
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
    const runtimeFragment = await renderPreviewFragment();

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
    expect(runtimeFragment).toContain("border-radius:0.25rem");
    expect(embedSurveyPreviewEmailHtml).toContain("border-radius:0.25rem");
    expect(runtimeFragment).not.toContain("☐");
    expect(embedSurveyPreviewEmailHtml).not.toContain("☐");
    expect(normalizeHtml(runtimeFragment)).toBe(normalizeHtml(embedSurveyPreviewEmailHtml));
  });

  test("renders the checked-in survey preview fixture inside the React Email wrapper", async () => {
    const renderedHtml = await renderEmbedSurveyPreviewEmail({
      ...exampleData.embedSurveyPreviewEmail,
      t: mockT,
    });

    expect(exampleData.embedSurveyPreviewEmail.html).toBe(embedSurveyPreviewEmailHtml);
    expect(exampleData.embedSurveyPreviewEmail.html).toContain(EMBED_SURVEY_PREVIEW_HEADLINE);
    expect(exampleData.embedSurveyPreviewEmail.html).toContain("border-radius:0.25rem");
    expect(exampleData.embedSurveyPreviewEmail.html).toContain("Apples");
    expect(exampleData.embedSurveyPreviewEmail.html).not.toContain("Example Survey Embed");
    expect(exampleData.embedSurveyPreviewEmail.html).not.toMatch(/<!DOCTYPE|<html|<head|<body/i);
    expect(renderedHtml).toContain('name="color-scheme"');
    expect(renderedHtml).toContain('content="only light"');
    expect(renderedHtml).toContain('name="supported-color-schemes"');
    expect(renderedHtml).not.toContain("@media");
    expect(renderedHtml).not.toContain("background-image");
    expect(normalizeHtml(renderedHtml)).toContain(normalizeHtml(embedSurveyPreviewEmailHtml));
  });

  test.each(runtimeCoverageCases)(
    "covers the $name preview branch without nested document markup",
    async ({ type, expectedTexts, expectedHrefFragments }) => {
      const fragment = await renderPreviewFragment(type);
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
    const multiChoiceFragment = await renderPreviewFragment(TSurveyElementTypeEnum.MultipleChoiceMulti);

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
    expect(multiChoiceFragment).toContain("border-radius:0.25rem");
    expect(multiChoiceFragment).toContain("height:1rem");
    expect(multiChoiceFragment).not.toContain("☐");
    expect(multiChoiceFragment).not.toMatch(/<a\b[^>]*style="[^"]*width:\s*100%/i);
  });

  test("uses stable encoded choice ids for single-choice prefilling links", async () => {
    const singleChoiceFragment = await renderPreviewFragment(TSurveyElementTypeEnum.MultipleChoiceSingle);

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
    expect(singleChoiceFragment).toContain("border-radius:9999px");
    expect(singleChoiceFragment).not.toContain("◯");
  });

  test("keeps preview controls close to survey UI styling", async () => {
    const [
      rankingFragment,
      npsFragment,
      ratingFragment,
      dateFragment,
      ctaFragment,
      fileUploadFragment,
      addressFragment,
      contactInfoFragment,
      matrixFragment,
    ] = await Promise.all([
      renderPreviewFragment(TSurveyElementTypeEnum.Ranking),
      renderPreviewFragment(TSurveyElementTypeEnum.NPS),
      renderPreviewFragment(TSurveyElementTypeEnum.Rating),
      renderPreviewFragment(TSurveyElementTypeEnum.Date),
      renderPreviewFragment(TSurveyElementTypeEnum.CTA),
      renderPreviewFragment(TSurveyElementTypeEnum.FileUpload),
      renderPreviewFragment(TSurveyElementTypeEnum.Address),
      renderPreviewFragment(TSurveyElementTypeEnum.ContactInfo),
      renderPreviewFragment(TSurveyElementTypeEnum.Matrix),
    ]);

    expect(rankingFragment).toContain("1px dashed #22c55e");
    expect(npsFragment).toContain("box-sizing:border-box");
    expect(npsFragment).toContain("height:47px");
    expect(npsFragment).toContain("line-height:41px");
    expect(npsFragment).toContain("border-radius:8px 0 0 8px");
    expect(npsFragment).toContain("border-radius:0 8px 8px 0");
    expect(npsFragment).toContain("border-left:0 !important");
    expect(npsFragment).not.toContain("line-height:120%");
    expect(npsFragment).not.toContain("mso-text-raise");
    expect(npsFragment).not.toContain("padding-left:4px");
    expect(ratingFragment).toContain("height:47px");
    expect(ratingFragment).toContain("line-height:41px");
    expect(ratingFragment).toContain("border-radius:8px 0 0 8px");
    expect(ratingFragment).toContain("border-radius:0 8px 8px 0");
    expect(ratingFragment).toContain("border-left:0 !important");
    expect(ratingFragment).toMatch(/target="_blank"\s*>1<\/a/);
    expect(ratingFragment).not.toContain("height:46px");
    expect(dateFragment).toContain("lucide-calendar-days");
    expect(ctaFragment).toContain("text-align:left");
    expect(ctaFragment).toContain("lucide-square-arrow-out-up-right");
    expect(ctaFragment).not.toContain("↗");
    expect(fileUploadFragment).toContain("lucide-upload");
    expect(fileUploadFragment).toContain("2px dashed #d6e4dc");
    expect(fileUploadFragment).toContain("height:96px");
    expect(fileUploadFragment).toContain("line-height:96px");
    expect(fileUploadFragment).not.toContain("#64748b");
    expect(addressFragment).toContain("width:100%");
    expect(addressFragment).toMatch(
      new RegExp(`<p[^>]*>\\s*${EMBED_SURVEY_PREVIEW_ADDRESS_PLACEHOLDERS.addressLine1}\\s*</p>`)
    );
    expect(addressFragment).not.toContain(`>${EMBED_SURVEY_PREVIEW_ADDRESS_PLACEHOLDERS.addressLine1}</a>`);
    expect(contactInfoFragment).toContain("box-sizing:border-box");
    expect(contactInfoFragment).toMatch(
      new RegExp(`<p[^>]*>\\s*${EMBED_SURVEY_PREVIEW_CONTACT_PLACEHOLDERS.firstName}\\s*</p>`)
    );
    expect(contactInfoFragment).not.toContain(`>${EMBED_SURVEY_PREVIEW_CONTACT_PLACEHOLDERS.firstName}</a>`);
    expect(matrixFragment).toContain("text-align:center");
    expect(matrixFragment).toContain("height:1rem;width:1rem");
    expect(matrixFragment).toContain("border-radius:9999px");
    expect(matrixFragment).not.toContain("margin-right:0.75rem");
  });

  test("matches survey OpenText input sizing and placeholder opacity", async () => {
    const singleLineSurvey = createEmbedSurveyPreviewEmailSurvey(TSurveyElementTypeEnum.OpenText);
    const openTextQuestion = singleLineSurvey.blocks[0].elements[0];

    if (openTextQuestion.type !== TSurveyElementTypeEnum.OpenText) {
      throw new Error("Expected open text question fixture");
    }

    openTextQuestion.headline = {
      default:
        '<p class="fb-editor-paragraph" dir="ltr"><span style="white-space: pre-wrap;">Open text block</span></p>',
    };
    openTextQuestion.longAnswer = false;

    const openTextStyling = {
      ...EMBED_SURVEY_PREVIEW_STYLING,
      inputColor: { light: "#fcedf0" },
      inputTextColor: { light: "#901629" },
      inputPlaceholderOpacity: 0.5,
      inputHeight: 20,
    };
    const expectedPlaceholderColor = mixColor(mixColor("#901629", "#ffffff", 0.3), "#fcedf0", 0.5);
    const singleLineHtml = await getPreviewEmailTemplateHtml(
      singleLineSurvey,
      EMBED_SURVEY_PREVIEW_SURVEY_URL,
      openTextStyling,
      EMBED_SURVEY_PREVIEW_LOCALE,
      mockPreviewT
    );
    const singleLineFragment = extractEmailBodyFragment(singleLineHtml);

    expect(singleLineFragment).toContain(EMBED_SURVEY_PREVIEW_OPEN_TEXT_PLACEHOLDER);
    expect(singleLineFragment).toContain('class="fb-editor-paragraph" dir="ltr" style="margin:0"');
    expect(singleLineFragment).toContain("min-height:20px");
    expect(singleLineFragment).toContain(`color:${expectedPlaceholderColor} !important`);
    expect(singleLineFragment).toContain("text-decoration:none !important");
    expect(singleLineFragment).toContain("background-color:#fcedf0 !important");
    expect(singleLineFragment).toMatch(
      /<div\b[^>]*style="[^"]*background-color:#fcedf0 !important[^"]*border-radius:8px[^"]*overflow:hidden[^"]*padding:8px 8px/
    );
    expect(singleLineFragment).toContain("overflow:hidden");
    expect(singleLineFragment).toContain("padding:8px 8px");
    expect(singleLineFragment).not.toMatch(/<td\b[^>]*bgcolor="#fcedf0"/);
    expect(singleLineFragment).toMatch(/<a\b[\s\S]*?>\s*<span\b/i);
    expect(singleLineFragment).toContain(`>${EMBED_SURVEY_PREVIEW_OPEN_TEXT_PLACEHOLDER}</span`);
    expect(singleLineFragment).not.toMatch(/<a\b[^>]*>\s*<p\b/i);
    expect(singleLineFragment).not.toMatch(/<a\b[^>]*border:1px solid/i);
    expect(singleLineFragment).not.toContain("min-height:64px");

    openTextQuestion.longAnswer = true;

    const longAnswerHtml = await getPreviewEmailTemplateHtml(
      singleLineSurvey,
      EMBED_SURVEY_PREVIEW_SURVEY_URL,
      openTextStyling,
      EMBED_SURVEY_PREVIEW_LOCALE,
      mockPreviewT
    );
    const longAnswerFragment = extractEmailBodyFragment(longAnswerHtml);

    expect(longAnswerFragment).toContain("min-height:64px");
    expect(longAnswerFragment).toContain("background-color:#fcedf0 !important");
    expect(longAnswerFragment).toMatch(
      /<div\b[^>]*style="[^"]*background-color:#fcedf0 !important[^"]*border-radius:8px[^"]*overflow:hidden[^"]*padding:8px 8px/
    );
    expect(longAnswerFragment).toContain("overflow:hidden");
    expect(longAnswerFragment).toContain("padding:8px 8px");
    expect(longAnswerFragment).not.toMatch(/<td\b[^>]*bgcolor="#fcedf0"/);
    expect(longAnswerFragment).toContain("text-decoration:none !important");
    expect(longAnswerFragment).toMatch(/<a\b[\s\S]*?>\s*<span\b/i);
    expect(longAnswerFragment).toContain(`>${EMBED_SURVEY_PREVIEW_OPEN_TEXT_PLACEHOLDER}</span`);
    expect(longAnswerFragment).not.toMatch(/<a\b[^>]*>\s*<p\b/i);
    expect(longAnswerFragment).not.toMatch(/<a\b[^>]*border:1px solid/i);
  });

  test("renders star ratings with SVG icons instead of emoji", async () => {
    const starRatingSurvey = createEmbedSurveyPreviewEmailSurvey(TSurveyElementTypeEnum.Rating);
    const ratingQuestion = starRatingSurvey.blocks[0].elements[0];

    if (ratingQuestion.type !== TSurveyElementTypeEnum.Rating) {
      throw new Error("Expected rating question fixture");
    }

    ratingQuestion.scale = "star";
    ratingQuestion.isColorCodingEnabled = false;

    const starRatingHtml = await getPreviewEmailTemplateHtml(
      starRatingSurvey,
      EMBED_SURVEY_PREVIEW_SURVEY_URL,
      EMBED_SURVEY_PREVIEW_STYLING,
      EMBED_SURVEY_PREVIEW_LOCALE,
      mockPreviewT
    );
    const starRatingFragment = extractEmailBodyFragment(starRatingHtml);

    expect(starRatingFragment).toContain("lucide-star");
    expect(starRatingFragment).not.toContain("⭐");
  });
});
