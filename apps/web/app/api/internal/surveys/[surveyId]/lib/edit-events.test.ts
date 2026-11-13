import { buildSavedSurvey } from "@/modules/survey/editor/lib/__mocks__/saved-survey.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { captureSurveyEditDiffEvents } from "./edit-events";

const mocks = vi.hoisted(() => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
vi.mock("server-only", () => ({}));

const CONTEXT = { userId: "user_1", surveyId: "survey_1", organizationId: "org_1", workspaceId: "ws_1" };
const BASE = { organization_id: "org_1", workspace_id: "ws_1", survey_id: "survey_1" };

const language = (code: string) => ({
  default: code === "en",
  enabled: true,
  language: {
    id: `cl${code}`,
    code,
    alias: null,
    workspaceId: "ws_1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

const captured = () => mocks.capturePostHogEvent.mock.calls.map(([, event, props]) => [event, props]);

const run = (oldOverrides: Partial<TSurvey>, newOverrides: Partial<TSurvey>) =>
  captureSurveyEditDiffEvents(buildSavedSurvey(oldOverrides), buildSavedSurvey(newOverrides), CONTEXT);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("captureSurveyEditDiffEvents", () => {
  test("sends nothing for a save that adds nothing, or without a stored survey", () => {
    run({}, {});
    captureSurveyEditDiffEvents(null, buildSavedSurvey(), CONTEXT);

    expect(captured()).toEqual([]);
  });

  test("enables languages on a single-language survey, then adds the rest, counting as it goes", () => {
    run({ languages: [] }, { languages: [language("en"), language("de"), language("fr")] });

    expect(captured()).toEqual([
      ["survey_language_enabled", { ...BASE, language_code: "en", existing_language_count: 0 }],
      ["survey_language_added", { ...BASE, language_code: "de", existing_language_count: 1 }],
      ["survey_language_added", { ...BASE, language_code: "fr", existing_language_count: 2 }],
    ]);
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      "user_1",
      "survey_language_enabled",
      expect.anything(),
      { organizationId: "org_1", workspaceId: "ws_1" }
    );
  });

  test("only adds languages on a survey that already had several", () => {
    run(
      { languages: [language("en"), language("de")] },
      { languages: [language("en"), language("de"), language("fr")] }
    );

    expect(captured()).toEqual([
      ["survey_language_added", { ...BASE, language_code: "fr", existing_language_count: 2 }],
    ]);
  });

  test("names hidden fields, block logic, variables and follow-ups the save added", () => {
    const stored = buildSavedSurvey();
    const block = stored.blocks[0];

    run(
      { hiddenFields: { enabled: true, fieldIds: ["a"] }, variables: [], followUps: [] },
      {
        hiddenFields: { enabled: true, fieldIds: ["a", "b"] },
        blocks: [{ ...block, logicFallback: "end" } as TSurvey["blocks"][number]],
        variables: [{ id: "clvar1111111111111111111", name: "score", type: "number", value: 0 }],
        followUps: [
          ...stored.followUps,
          { ...stored.followUps[0], id: "clgone1111111111111111111", deleted: true },
        ],
      }
    );

    expect(captured()).toEqual([
      ["hidden_field_added", { ...BASE, field_count: 2 }],
      ["conditional_logic_added", { ...BASE, question_id: block.id }],
      ["variable_created", { ...BASE, variable_type: "number" }],
      ["follow_up_added", { ...BASE, follow_up_id: stored.followUps[0].id }],
    ]);
  });
});
