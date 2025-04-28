import { describe, expect, test } from "vitest";
import { TShuffleOption, TSurveyLogic, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TTemplateRole } from "@formbricks/types/templates";
import {
  buildCTAQuestion,
  buildConsentQuestion,
  buildMultipleChoiceQuestion,
  buildNPSQuestion,
  buildOpenTextQuestion,
  buildRatingQuestion,
  buildSurvey,
  createChoiceJumpLogic,
  createJumpLogic,
  getDefaultEndingCard,
  getDefaultSurveyPreset,
  getDefaultWelcomeCard,
  hiddenFieldsDefault,
} from "./survey-builder";

// Mock the TFnType from @tolgee/react
const mockT = (props: any): string => (typeof props === "string" ? props : props.key);

describe("Survey Builder", () => {
  describe("buildMultipleChoiceQuestion", () => {
    test("creates a single choice question with required fields", () => {
      const question = buildMultipleChoiceQuestion({
        headline: "Test Question",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        choices: ["Option 1", "Option 2", "Option 3"],
        t: mockT,
      });

      expect(question).toMatchObject({
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Test Question" },
        choices: expect.arrayContaining([
          expect.objectContaining({ label: { default: "Option 1" } }),
          expect.objectContaining({ label: { default: "Option 2" } }),
          expect.objectContaining({ label: { default: "Option 3" } }),
        ]),
        buttonLabel: { default: "common.next" },
        backButtonLabel: { default: "common.back" },
        shuffleOption: "none",
        required: true,
      });
      expect(question.choices.length).toBe(3);
      expect(question.id).toBeDefined();
    });

    test("creates a multiple choice question with provided ID", () => {
      const customId = "custom-id-123";
      const question = buildMultipleChoiceQuestion({
        id: customId,
        headline: "Test Question",
        type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
        choices: ["Option 1", "Option 2"],
        t: mockT,
      });

      expect(question.id).toBe(customId);
      expect(question.type).toBe(TSurveyQuestionTypeEnum.MultipleChoiceMulti);
    });

    test("handles 'other' option correctly", () => {
      const choices = ["Option 1", "Option 2", "Other"];
      const question = buildMultipleChoiceQuestion({
        headline: "Test Question",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        choices,
        containsOther: true,
        t: mockT,
      });

      expect(question.choices.length).toBe(3);
      expect(question.choices[2].id).toBe("other");
    });

    test("uses provided choice IDs when available", () => {
      const choiceIds = ["id1", "id2", "id3"];
      const question = buildMultipleChoiceQuestion({
        headline: "Test Question",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        choices: ["Option 1", "Option 2", "Option 3"],
        choiceIds,
        t: mockT,
      });

      expect(question.choices[0].id).toBe(choiceIds[0]);
      expect(question.choices[1].id).toBe(choiceIds[1]);
      expect(question.choices[2].id).toBe(choiceIds[2]);
    });

    test("applies all optional parameters correctly", () => {
      const logic: TSurveyLogic[] = [
        {
          id: "logic-1",
          conditions: {
            id: "cond-1",
            connector: "and",
            conditions: [],
          },
          actions: [],
        },
      ];

      const shuffleOption: TShuffleOption = "all";

      const question = buildMultipleChoiceQuestion({
        headline: "Test Question",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        subheader: "This is a subheader",
        choices: ["Option 1", "Option 2"],
        buttonLabel: "Custom Next",
        backButtonLabel: "Custom Back",
        shuffleOption,
        required: false,
        logic,
        t: mockT,
      });

      expect(question.subheader).toEqual({ default: "This is a subheader" });
      expect(question.buttonLabel).toEqual({ default: "Custom Next" });
      expect(question.backButtonLabel).toEqual({ default: "Custom Back" });
      expect(question.shuffleOption).toBe("all");
      expect(question.required).toBe(false);
      expect(question.logic).toBe(logic);
    });
  });

  describe("buildOpenTextQuestion", () => {
    test("creates an open text question with required fields", () => {
      const question = buildOpenTextQuestion({
        headline: "Open Question",
        inputType: "text",
        t: mockT,
      });

      expect(question).toMatchObject({
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Open Question" },
        inputType: "text",
        buttonLabel: { default: "common.next" },
        backButtonLabel: { default: "common.back" },
        required: true,
        charLimit: {
          enabled: false,
        },
      });
      expect(question.id).toBeDefined();
    });

    test("applies all optional parameters correctly", () => {
      const logic: TSurveyLogic[] = [
        {
          id: "logic-1",
          conditions: {
            id: "cond-1",
            connector: "and",
            conditions: [],
          },
          actions: [],
        },
      ];

      const question = buildOpenTextQuestion({
        id: "custom-id",
        headline: "Open Question",
        subheader: "Answer this question",
        placeholder: "Type here",
        buttonLabel: "Submit",
        backButtonLabel: "Previous",
        required: false,
        longAnswer: true,
        inputType: "email",
        logic,
        t: mockT,
      });

      expect(question.id).toBe("custom-id");
      expect(question.subheader).toEqual({ default: "Answer this question" });
      expect(question.placeholder).toEqual({ default: "Type here" });
      expect(question.buttonLabel).toEqual({ default: "Submit" });
      expect(question.backButtonLabel).toEqual({ default: "Previous" });
      expect(question.required).toBe(false);
      expect(question.longAnswer).toBe(true);
      expect(question.inputType).toBe("email");
      expect(question.logic).toBe(logic);
    });
  });

  describe("buildRatingQuestion", () => {
    test("creates a rating question with required fields", () => {
      const question = buildRatingQuestion({
        headline: "Rating Question",
        scale: "number",
        range: 5,
        t: mockT,
      });

      expect(question).toMatchObject({
        type: TSurveyQuestionTypeEnum.Rating,
        headline: { default: "Rating Question" },
        scale: "number",
        range: 5,
        buttonLabel: { default: "common.next" },
        backButtonLabel: { default: "common.back" },
        required: true,
        isColorCodingEnabled: false,
      });
      expect(question.id).toBeDefined();
    });

    test("applies all optional parameters correctly", () => {
      const logic: TSurveyLogic[] = [
        {
          id: "logic-1",
          conditions: {
            id: "cond-1",
            connector: "and",
            conditions: [],
          },
          actions: [],
        },
      ];

      const question = buildRatingQuestion({
        id: "custom-id",
        headline: "Rating Question",
        subheader: "Rate us",
        scale: "star",
        range: 10,
        lowerLabel: "Poor",
        upperLabel: "Excellent",
        buttonLabel: "Submit",
        backButtonLabel: "Previous",
        required: false,
        isColorCodingEnabled: true,
        logic,
        t: mockT,
      });

      expect(question.id).toBe("custom-id");
      expect(question.subheader).toEqual({ default: "Rate us" });
      expect(question.scale).toBe("star");
      expect(question.range).toBe(10);
      expect(question.lowerLabel).toEqual({ default: "Poor" });
      expect(question.upperLabel).toEqual({ default: "Excellent" });
      expect(question.buttonLabel).toEqual({ default: "Submit" });
      expect(question.backButtonLabel).toEqual({ default: "Previous" });
      expect(question.required).toBe(false);
      expect(question.isColorCodingEnabled).toBe(true);
      expect(question.logic).toBe(logic);
    });
  });

  describe("buildNPSQuestion", () => {
    test("creates an NPS question with required fields", () => {
      const question = buildNPSQuestion({
        headline: "NPS Question",
        t: mockT,
      });

      expect(question).toMatchObject({
        type: TSurveyQuestionTypeEnum.NPS,
        headline: { default: "NPS Question" },
        buttonLabel: { default: "common.next" },
        backButtonLabel: { default: "common.back" },
        required: true,
        isColorCodingEnabled: false,
      });
      expect(question.id).toBeDefined();
    });

    test("applies all optional parameters correctly", () => {
      const logic: TSurveyLogic[] = [
        {
          id: "logic-1",
          conditions: {
            id: "cond-1",
            connector: "and",
            conditions: [],
          },
          actions: [],
        },
      ];

      const question = buildNPSQuestion({
        id: "custom-id",
        headline: "NPS Question",
        subheader: "How likely are you to recommend us?",
        lowerLabel: "Not likely",
        upperLabel: "Very likely",
        buttonLabel: "Submit",
        backButtonLabel: "Previous",
        required: false,
        isColorCodingEnabled: true,
        logic,
        t: mockT,
      });

      expect(question.id).toBe("custom-id");
      expect(question.subheader).toEqual({ default: "How likely are you to recommend us?" });
      expect(question.lowerLabel).toEqual({ default: "Not likely" });
      expect(question.upperLabel).toEqual({ default: "Very likely" });
      expect(question.buttonLabel).toEqual({ default: "Submit" });
      expect(question.backButtonLabel).toEqual({ default: "Previous" });
      expect(question.required).toBe(false);
      expect(question.isColorCodingEnabled).toBe(true);
      expect(question.logic).toBe(logic);
    });
  });

  describe("buildConsentQuestion", () => {
    test("creates a consent question with required fields", () => {
      const question = buildConsentQuestion({
        headline: "Consent Question",
        label: "I agree to terms",
        t: mockT,
      });

      expect(question).toMatchObject({
        type: TSurveyQuestionTypeEnum.Consent,
        headline: { default: "Consent Question" },
        label: { default: "I agree to terms" },
        buttonLabel: { default: "common.next" },
        backButtonLabel: { default: "common.back" },
        required: true,
      });
      expect(question.id).toBeDefined();
    });

    test("applies all optional parameters correctly", () => {
      const logic: TSurveyLogic[] = [
        {
          id: "logic-1",
          conditions: {
            id: "cond-1",
            connector: "and",
            conditions: [],
          },
          actions: [],
        },
      ];

      const question = buildConsentQuestion({
        id: "custom-id",
        headline: "Consent Question",
        subheader: "Please read the terms",
        label: "I agree to terms",
        buttonLabel: "Submit",
        backButtonLabel: "Previous",
        required: false,
        logic,
        t: mockT,
      });

      expect(question.id).toBe("custom-id");
      expect(question.subheader).toEqual({ default: "Please read the terms" });
      expect(question.label).toEqual({ default: "I agree to terms" });
      expect(question.buttonLabel).toEqual({ default: "Submit" });
      expect(question.backButtonLabel).toEqual({ default: "Previous" });
      expect(question.required).toBe(false);
      expect(question.logic).toBe(logic);
    });
  });

  describe("buildCTAQuestion", () => {
    test("creates a CTA question with required fields", () => {
      const question = buildCTAQuestion({
        headline: "CTA Question",
        buttonExternal: false,
        t: mockT,
      });

      expect(question).toMatchObject({
        type: TSurveyQuestionTypeEnum.CTA,
        headline: { default: "CTA Question" },
        buttonLabel: { default: "common.next" },
        backButtonLabel: { default: "common.back" },
        required: true,
        buttonExternal: false,
      });
      expect(question.id).toBeDefined();
    });

    test("applies all optional parameters correctly", () => {
      const logic: TSurveyLogic[] = [
        {
          id: "logic-1",
          conditions: {
            id: "cond-1",
            connector: "and",
            conditions: [],
          },
          actions: [],
        },
      ];

      const question = buildCTAQuestion({
        id: "custom-id",
        headline: "CTA Question",
        html: "<p>Click the button</p>",
        buttonLabel: "Click me",
        buttonExternal: true,
        buttonUrl: "https://example.com",
        backButtonLabel: "Previous",
        required: false,
        dismissButtonLabel: "No thanks",
        logic,
        t: mockT,
      });

      expect(question.id).toBe("custom-id");
      expect(question.html).toEqual({ default: "<p>Click the button</p>" });
      expect(question.buttonLabel).toEqual({ default: "Click me" });
      expect(question.buttonExternal).toBe(true);
      expect(question.buttonUrl).toBe("https://example.com");
      expect(question.backButtonLabel).toEqual({ default: "Previous" });
      expect(question.required).toBe(false);
      expect(question.dismissButtonLabel).toEqual({ default: "No thanks" });
      expect(question.logic).toBe(logic);
    });

    test("handles external button with URL", () => {
      const question = buildCTAQuestion({
        headline: "CTA Question",
        buttonExternal: true,
        buttonUrl: "https://formbricks.com",
        t: mockT,
      });

      expect(question.buttonExternal).toBe(true);
      expect(question.buttonUrl).toBe("https://formbricks.com");
    });
  });

  // Test combinations of parameters for edge cases
  describe("Edge cases", () => {
    test("multiple choice question with empty choices array", () => {
      const question = buildMultipleChoiceQuestion({
        headline: "Test Question",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        choices: [],
        t: mockT,
      });

      expect(question.choices).toEqual([]);
    });

    test("open text question with all parameters", () => {
      const question = buildOpenTextQuestion({
        id: "custom-id",
        headline: "Open Question",
        subheader: "Answer this question",
        placeholder: "Type here",
        buttonLabel: "Submit",
        backButtonLabel: "Previous",
        required: false,
        longAnswer: true,
        inputType: "email",
        logic: [],
        t: mockT,
      });

      expect(question).toMatchObject({
        id: "custom-id",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Open Question" },
        subheader: { default: "Answer this question" },
        placeholder: { default: "Type here" },
        buttonLabel: { default: "Submit" },
        backButtonLabel: { default: "Previous" },
        required: false,
        longAnswer: true,
        inputType: "email",
        logic: [],
      });
    });
  });
});

describe("Helper Functions", () => {
  test("createJumpLogic returns valid jump logic", () => {
    const sourceId = "q1";
    const targetId = "q2";
    const operator: "isClicked" = "isClicked";
    const logic = createJumpLogic(sourceId, targetId, operator);

    // Check structure
    expect(logic).toHaveProperty("id");
    expect(logic).toHaveProperty("conditions");
    expect(logic.conditions).toHaveProperty("conditions");
    expect(Array.isArray(logic.conditions.conditions)).toBe(true);

    // Check one of the inner conditions
    const condition = logic.conditions.conditions[0];
    // Need to use type checking to ensure condition is a TSingleCondition not a TConditionGroup
    if (!("connector" in condition)) {
      expect(condition.leftOperand.value).toBe(sourceId);
      expect(condition.operator).toBe(operator);
    }

    // Check actions
    expect(Array.isArray(logic.actions)).toBe(true);
    const action = logic.actions[0];
    if (action.objective === "jumpToQuestion") {
      expect(action.target).toBe(targetId);
    }
  });

  test("createChoiceJumpLogic returns valid jump logic based on choice selection", () => {
    const sourceId = "q1";
    const choiceId = "choice1";
    const targetId = "q2";
    const logic = createChoiceJumpLogic(sourceId, choiceId, targetId);

    expect(logic).toHaveProperty("id");
    expect(logic.conditions).toHaveProperty("conditions");

    const condition = logic.conditions.conditions[0];
    if (!("connector" in condition)) {
      expect(condition.leftOperand.value).toBe(sourceId);
      expect(condition.operator).toBe("equals");
      expect(condition.rightOperand?.value).toBe(choiceId);
    }

    const action = logic.actions[0];
    if (action.objective === "jumpToQuestion") {
      expect(action.target).toBe(targetId);
    }
  });

  test("getDefaultWelcomeCard returns expected welcome card", () => {
    const card = getDefaultWelcomeCard(mockT);
    expect(card.enabled).toBe(false);
    expect(card.headline).toEqual({ default: "templates.default_welcome_card_headline" });
    expect(card.html).toEqual({ default: "templates.default_welcome_card_html" });
    expect(card.buttonLabel).toEqual({ default: "templates.default_welcome_card_button_label" });
    // boolean flags
    expect(card.timeToFinish).toBe(false);
    expect(card.showResponseCount).toBe(false);
  });

  test("getDefaultEndingCard returns expected end screen card", () => {
    // Pass empty languages array to simulate no languages
    const card = getDefaultEndingCard([], mockT);
    expect(card).toHaveProperty("id");
    expect(card.type).toBe("endScreen");
    expect(card.headline).toEqual({ default: "templates.default_ending_card_headline" });
    expect(card.subheader).toEqual({ default: "templates.default_ending_card_subheader" });
    expect(card.buttonLabel).toEqual({ default: "templates.default_ending_card_button_label" });
    expect(card.buttonLink).toBe("https://formbricks.com");
  });

  test("getDefaultSurveyPreset returns expected default survey preset", () => {
    const preset = getDefaultSurveyPreset(mockT);
    expect(preset.name).toBe("New Survey");
    expect(preset.questions).toEqual([]);
    // test welcomeCard and endings
    expect(preset.welcomeCard).toHaveProperty("headline");
    expect(Array.isArray(preset.endings)).toBe(true);
    expect(preset.hiddenFields).toEqual(hiddenFieldsDefault);
  });

  test("buildSurvey returns built survey with overridden preset properties", () => {
    const config = {
      name: "Custom Survey",
      role: "productManager" as TTemplateRole,
      industries: ["eCommerce"] as string[],
      channels: ["link"],
      description: "Test survey",
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText, // changed from "OpenText"
          headline: { default: "Question 1" },
          inputType: "text",
          buttonLabel: { default: "Next" },
          backButtonLabel: { default: "Back" },
          required: true,
        },
      ],
      endings: [
        {
          id: "end1",
          type: "endScreen",
          headline: { default: "End Screen" },
          subheader: { default: "Thanks" },
          buttonLabel: { default: "Finish" },
          buttonLink: "https://formbricks.com",
        },
      ],
      hiddenFields: { enabled: false, fieldIds: ["f1"] },
    };

    const survey = buildSurvey(config as any, mockT);
    expect(survey.name).toBe(config.name);
    expect(survey.role).toBe(config.role);
    expect(survey.industries).toEqual(config.industries);
    expect(survey.channels).toEqual(config.channels);
    expect(survey.description).toBe(config.description);
    // preset overrides
    expect(survey.preset.name).toBe(config.name);
    expect(survey.preset.questions).toEqual(config.questions);
    expect(survey.preset.endings).toEqual(config.endings);
    expect(survey.preset.hiddenFields).toEqual(config.hiddenFields);
  });

  test("hiddenFieldsDefault has expected default configuration", () => {
    expect(hiddenFieldsDefault).toEqual({ enabled: true, fieldIds: [] });
  });
});
