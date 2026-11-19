import { describe, expect, test } from "vitest";
import { SURVEY_FLOW_FIXTURE_IDS, surveyFlowFixture } from "./test-fixtures/survey-flow-fixture";
import { type TSurvey, TSurveyQuestionTypeEnum, ZSurvey } from "./types";

/**
 * The survey-level checks of `surveyRefinement` outside logic: the model, block and element labels
 * and settings, endings and follow-ups. Each case breaks one thing in the shared fixture (or a
 * questions-model copy of it) and expects its refusal.
 */

const ids = SURVEY_FLOW_FIXTURE_IDS;
const i18n = (text: string) => ({ default: text });

const issuesOf = (survey: TSurvey) =>
  (ZSurvey.safeParse(survey).error?.issues ?? []).map(({ path, message }) => ({
    path: path.join("."),
    message,
  }));

/** The fixture with `update` applied to a copy. */
const fixtureWith = (update: (survey: TSurvey) => void): TSurvey => {
  const survey = structuredClone(surveyFlowFixture);
  update(survey);
  return survey;
};

/** The fixture's element `id`, with its block and position, for a test to change. */
const locate = (survey: TSurvey, id: string) => {
  for (const [blockIndex, block] of survey.blocks.entries()) {
    const elementIndex = block.elements.findIndex((element) => element.id === id);
    if (elementIndex !== -1) {
      return { blockIndex, elementIndex, element: block.elements[elementIndex] as Record<string, unknown> };
    }
  }
  throw new Error(`no element ${id}`);
};

/** One element of the fixture changed, with the refusal expected at its path plus `pathSuffix`. */
const expectElementIssue = (
  id: string,
  change: (element: Record<string, unknown>) => void,
  pathSuffix: string,
  message: (where: string) => string
) => {
  const survey = structuredClone(surveyFlowFixture);
  const { blockIndex, elementIndex, element } = locate(survey, id);
  change(element);
  const elementPath = `blocks.${String(blockIndex)}.elements.${String(elementIndex)}`;
  expect(issuesOf(survey)).toContainEqual({
    path: pathSuffix ? `${elementPath}.${pathSuffix}` : elementPath,
    message: message(`${String(elementIndex + 1)} in block ${String(blockIndex + 1)}`),
  });
};

describe("survey refinement (blocks model)", () => {
  test("the fixture is valid", () => {
    expect(issuesOf(surveyFlowFixture)).toEqual([]);
  });

  test("refuses a survey with neither questions nor elements", () => {
    expect(issuesOf(fixtureWith((survey) => (survey.blocks = [])))).toContainEqual({
      path: "questions",
      message: "Survey must have either questions or blocks with elements",
    });
  });

  test("refuses two blocks with one id", () => {
    expect(issuesOf(fixtureWith((survey) => (survey.blocks[1].id = survey.blocks[0].id)))).toContainEqual({
      path: "blocks.1.id",
      message: "Block IDs must be unique",
    });
  });

  test("refuses an element id used twice", () => {
    const survey = fixtureWith((s) => {
      s.blocks[1].elements.push({ ...s.blocks[0].elements[0] });
    });
    expect(issuesOf(survey)).toContainEqual({
      path: `blocks.1.elements.${String(survey.blocks[1].elements.length - 1)}.id`,
      message: `Element ID "services" is used in multiple blocks. Element IDs must be unique across all blocks.`,
    });
  });

  test("refuses duplicate choice labels", () => {
    expectElementIssue(
      "fav",
      (element) => {
        const choices = element.choices as { label: { default: string } }[];
        choices[1].label = { ...choices[0].label };
      },
      "choices",
      (where) => `Element ${where} has duplicate choice labels `
    );
  });

  test("refuses duplicate matrix row labels", () => {
    expectElementIssue(
      "brand_grid",
      (element) => {
        const rows = element.rows as { label: { default: string } }[];
        rows[1].label = { ...rows[0].label };
      },
      "rows",
      (where) => `Question ${where} has duplicate row labels `
    );
  });

  test("refuses an external CTA without a URL", () => {
    expectElementIssue(
      "learn_more",
      (element) => {
        element.buttonExternal = true;
        element.ctaButtonLabel = i18n("Read more");
      },
      "buttonUrl",
      (where) => `Element ${where}: Button URL is required when external button is enabled`
    );
  });

  test("refuses a file upload with no allowed extension", () => {
    expectElementIssue(
      "receipt",
      (element) => (element.allowedFileExtensions = []),
      "allowedFileExtensions",
      (where) => `Question ${where} must have atleast one allowed file extension`
    );
  });

  test("refuses an invalid Cal host", () => {
    expectElementIssue(
      "interview",
      (element) => (element.calHost = "not a host"),
      "calHost",
      (where) => `Question ${where} must have a valid host name`
    );
  });

  test.each([
    ["contact", "Contact Info", ["firstName", "lastName", "email", "phone", "company"]],
    ["address", "Address", ["addressLine1", "addressLine2", "city", "state", "zip", "country"]],
  ])("refuses a %s element with every field hidden", (id, name, fields) => {
    expectElementIssue(
      id,
      (element) => {
        for (const field of fields) (element[field] as { show: boolean }).show = false;
      },
      "",
      (where) => `At least one field must be shown in the ${name} question ${where}`
    );
  });

  test("refuses an end screen button with a label but no link, and one with a link but no label", () => {
    const issues = issuesOf(
      fixtureWith((survey) => {
        survey.endings[0] = { ...survey.endings[0], buttonLabel: i18n("Go") } as TSurvey["endings"][number];
        survey.endings[1] = {
          ...survey.endings[1],
          buttonLink: "https://example.com",
        } as TSurvey["endings"][number];
      })
    );
    expect(issues).toContainEqual({
      path: "endings.0.buttonLink",
      message: "Ending card 1: Button link cannot be empty",
    });
    expect(issues).toContainEqual({
      path: "endings.1.buttonLabel",
      message: "Ending card 2: Button label cannot be empty",
    });
  });

  test("refuses a redirect ending without a label or URL", () => {
    const issues = issuesOf(
      fixtureWith((survey) => {
        survey.endings[3] = { ...survey.endings[3], url: "", label: "" } as TSurvey["endings"][number];
      })
    );
    expect(issues).toContainEqual({
      path: "endings.3.label",
      message: "Redirect Url label cannot be empty for ending Card 4.",
    });
    expect(issues).toContainEqual({
      path: "endings.3.url",
      message: "Ending card 4: Redirect URL cannot be empty",
    });
  });

  test("refuses a follow-up to an address that is no field or email, and one with no ending", () => {
    const followUp = (to: string, trigger: Record<string, unknown>) => ({
      id: "followupfixture000000001",
      createdAt: new Date("2026-11-03T00:00:00.000Z"),
      updatedAt: new Date("2026-11-03T00:00:00.000Z"),
      name: "Follow-up",
      trigger,
      action: {
        type: "send-email",
        properties: {
          to,
          from: "noreply@example.com",
          replyTo: [],
          subject: "Thanks",
          body: "Thanks",
          attachResponseData: false,
        },
      },
      surveyId: ids.survey,
      deleted: false,
    });
    const issues = issuesOf(
      fixtureWith((survey) => {
        survey.followUps = [
          followUp("not-an-email", { type: "response", properties: null }),
          followUp("email", { type: "endings", properties: { endingIds: [] } }),
        ] as unknown as TSurvey["followUps"];
      })
    );
    expect(issues).toContainEqual({
      path: "followUps",
      message: "The action in follow up 1 has an invalid email field",
    });
    expect(issues).toContainEqual({
      path: "followUps",
      message: "The trigger in follow up 2 has no ending selected",
    });
  });
});

describe("survey refinement (questions model)", () => {
  const legacy = (question: Record<string, unknown>): TSurvey => {
    const survey = structuredClone(surveyFlowFixture) as unknown as Record<string, unknown>;
    survey.blocks = [];
    survey.startLogic = [];
    survey.questions = [
      { id: "q_first", type: TSurveyQuestionTypeEnum.OpenText, headline: i18n("First"), required: false },
      { id: "q_second", headline: i18n("Second"), required: false, ...question },
    ];
    return survey as unknown as TSurvey;
  };

  test("refuses a survey with both questions and blocks", () => {
    const survey = legacy({ type: TSurveyQuestionTypeEnum.OpenText });
    survey.blocks = structuredClone(surveyFlowFixture.blocks);
    expect(issuesOf(survey)).toContainEqual({
      path: "blocks",
      message: "Survey cannot have both questions and blocks. Use one model.",
    });
  });
});
