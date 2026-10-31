import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { EVERY_TEXT_SURVEY } from "./__fixtures__/every-text-survey";
import { hasDefaultText, walkSurveyTexts } from "./survey-texts";

describe("walkSurveyTexts", () => {
  test("keys every text by the ids of what holds it, in survey order", () => {
    expect(walkSurveyTexts(EVERY_TEXT_SURVEY).map((text) => text.key)).toEqual([
      "welcomeCard.headline",
      "welcomeCard.subheader",
      "welcomeCard.buttonLabel",
      "block.block-1.buttonLabel",
      "block.block-1.backButtonLabel",
      "element.open.headline",
      "element.open.subheader",
      "element.open.imageAltText",
      "element.open.placeholder",
      "element.single.headline",
      "element.single.choice.yes.label",
      "element.single.choice.no.label",
      "element.single.choice.other.label",
      "element.single.otherOptionPlaceholder",
      "element.multi.headline",
      "element.multi.choice.red.label",
      "element.multi.choice.blue.label",
      "element.nps.headline",
      "element.nps.lowerLabel",
      "element.nps.upperLabel",
      "element.cta.headline",
      "element.cta.ctaButtonLabel",
      "element.rating.headline",
      "element.rating.lowerLabel",
      "element.rating.upperLabel",
      "element.consent.headline",
      "element.consent.label",
      "element.pictures.headline",
      "element.pictures.choice.mug-a.imageAltText",
      "element.date.headline",
      "element.date.html",
      "element.matrix.headline",
      "element.matrix.row.row-price.label",
      "element.matrix.row.row-speed.label",
      "element.matrix.column.col-bad.label",
      "element.matrix.column.col-good.label",
      "element.address.headline",
      "element.address.addressLine1.placeholder",
      "element.address.addressLine2.placeholder",
      "element.address.city.placeholder",
      "element.address.state.placeholder",
      "element.address.zip.placeholder",
      "element.address.country.placeholder",
      "element.ranking.headline",
      "element.ranking.choice.speed.label",
      "element.ranking.choice.price.label",
      "element.contact.headline",
      "element.contact.firstName.placeholder",
      "element.contact.lastName.placeholder",
      "element.contact.email.placeholder",
      "element.contact.phone.placeholder",
      "element.contact.company.placeholder",
      "element.csat.headline",
      "element.csat.lowerLabel",
      "element.csat.upperLabel",
      "element.files.headline",
      "ending.ending-thanks.headline",
      "ending.ending-thanks.subheader",
      "ending.ending-thanks.imageAltText",
      "ending.ending-thanks.buttonLabel",
    ]);
  });

  test("keeps a text's key when its question moves, while its path follows the move", () => {
    const reordered = {
      ...EVERY_TEXT_SURVEY,
      blocks: [...EVERY_TEXT_SURVEY.blocks].reverse(),
    } as TSurvey;

    const original = walkSurveyTexts(EVERY_TEXT_SURVEY).find(
      (text) => text.key === "element.matrix.row.row-speed.label"
    );
    const moved = walkSurveyTexts(reordered).find(
      (text) => text.key === "element.matrix.row.row-speed.label"
    );

    expect(original?.path).toBe("blocks.1.elements.7.rows.1.label");
    expect(moved?.path).toBe("blocks.0.elements.7.rows.1.label");
    expect(moved?.value).toEqual({ default: "Speed", de: "Tempo" });
  });

  test("percent-encodes ids so a key always splits back into its segments", () => {
    const survey = {
      ...EVERY_TEXT_SURVEY,
      welcomeCard: { enabled: false },
      endings: [],
      blocks: [
        {
          id: "block-1",
          name: "Block 1",
          elements: [
            {
              id: "single",
              type: "multipleChoiceSingle",
              headline: { default: "Pick one" },
              required: true,
              choices: [{ id: "v1.2 %", label: { default: "Version 1.2" } }],
            },
          ],
        },
      ],
    } as unknown as TSurvey;

    expect(walkSurveyTexts(survey).map((text) => text.key)).toContain(
      "element.single.choice.v1%2E2%20%25.label"
    );
  });

  test("lists an Other placeholder the survey never stored, without a value", () => {
    const survey = {
      ...EVERY_TEXT_SURVEY,
      blocks: [
        {
          ...EVERY_TEXT_SURVEY.blocks[0],
          elements: [{ ...EVERY_TEXT_SURVEY.blocks[0].elements[1], otherOptionPlaceholder: undefined }],
        },
      ],
    } as TSurvey;

    const placeholder = walkSurveyTexts(survey).find(
      (text) => text.key === "element.single.otherOptionPlaceholder"
    );

    expect(placeholder).toMatchObject({ value: undefined });
    expect(placeholder && hasDefaultText(placeholder)).toBe(false);
  });

  test("counts rich text as empty when its markup holds no words", () => {
    const [headline] = walkSurveyTexts({
      ...EVERY_TEXT_SURVEY,
      welcomeCard: { enabled: true, headline: { default: "<p><br></p>" } },
    } as unknown as TSurvey);

    expect(headline.key).toBe("welcomeCard.headline");
    expect(hasDefaultText(headline)).toBe(false);
  });
});
