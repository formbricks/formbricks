import { describe, expect, test } from "vitest";
import {
  buildSurvey,
  getDefaultEndingCard,
  getDefaultSurveyPreset,
  getDefaultWelcomeCard,
  hiddenFieldsDefault,
} from "./survey-builder";

const mockT = (props: any): string => (typeof props === "string" ? props : props.key);

describe("Survey Builder", () => {
  describe("Helper Functions", () => {
    test("getDefaultSurveyPreset returns expected default survey preset", () => {
      const preset = getDefaultSurveyPreset(mockT);
      expect(preset.name).toBe("New Survey");
      // test welcomeCard and endings
      expect(preset.welcomeCard).toHaveProperty("headline");
      expect(preset.endings).toHaveLength(1);
      expect(preset.endings[0]).toHaveProperty("headline");
      expect(preset.hiddenFields).toEqual(hiddenFieldsDefault);
      expect(preset.blocks).toEqual([]);
    });

    test("getDefaultWelcomeCard returns expected welcome card", () => {
      const welcomeCard = getDefaultWelcomeCard(mockT);
      expect(welcomeCard).toMatchObject({
        enabled: false,
        headline: { default: "templates.default_welcome_card_headline" },
        timeToFinish: false,
        showResponseCount: false,
      });
      // Check that the welcome card is properly structured
      expect(welcomeCard).toHaveProperty("enabled");
      expect(welcomeCard).toHaveProperty("headline");
      expect(welcomeCard).toHaveProperty("showResponseCount");
      expect(welcomeCard).toHaveProperty("timeToFinish");
    });

    test("getDefaultEndingCard returns expected ending card", () => {
      const languages: string[] = [];
      const endingCard = getDefaultEndingCard(languages, mockT);
      expect(endingCard).toMatchObject({
        type: "endScreen",
        headline: { default: "templates.default_ending_card_headline" },
        subheader: { default: "templates.default_ending_card_subheader" },
      });
      expect(endingCard.id).toBeDefined();
      expect(endingCard).toHaveProperty("buttonLabel");
      expect(endingCard).toHaveProperty("buttonLink");
    });

    test("hiddenFieldsDefault has expected structure", () => {
      expect(hiddenFieldsDefault).toMatchObject({
        enabled: true,
        fieldIds: [],
      });
    });

    test("buildSurvey returns built survey with overridden preset properties", () => {
      const config = {
        name: "Custom Survey",
        role: "productManager" as const,
        industries: ["saas" as const],
        channels: ["link" as const],
        description: "A custom survey description",
        blocks: [],
        endings: [getDefaultEndingCard([], mockT)],
        hiddenFields: hiddenFieldsDefault,
      };

      const survey = buildSurvey(config, mockT);

      // role, industries, channels, description
      expect(survey.role).toBe(config.role);
      expect(survey.industries).toEqual(config.industries);
      expect(survey.channels).toEqual(config.channels);
      expect(survey.description).toBe(config.description);

      // preset overrides
      expect(survey.preset.name).toBe(config.name);
      expect(survey.preset.endings).toEqual(config.endings);
      expect(survey.preset.hiddenFields).toEqual(config.hiddenFields);
      expect(survey.preset.blocks).toEqual(config.blocks);

      // default values from getDefaultSurveyPreset
      expect(survey.preset.welcomeCard).toHaveProperty("headline");
    });
  });
});
