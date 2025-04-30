import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganizationBillingPlan } from "@formbricks/types/organizations";
import { TLanguage } from "@formbricks/types/project";
import { TSurvey, TSurveyEndScreenCard, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { EditEndingCard } from "./edit-ending-card";

vi.mock("./end-screen-form", () => ({
  EndScreenForm: vi.fn(() => <div data-testid="end-screen-form">EndScreenForm</div>),
}));

describe("EditEndingCard", () => {
  afterEach(() => {
    cleanup();
  });

  test("should render the EndScreenForm when the ending card type is 'endScreen'", () => {
    const endingCardId = "ending1";
    const localSurvey = {
      id: "testSurvey",
      name: "Test Survey",
      languages: [
        { language: { code: "en", name: "English" } as unknown as TLanguage } as unknown as TSurveyLanguage,
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      type: "link",
      questions: [],
      endings: [
        {
          id: endingCardId,
          type: "endScreen",
          headline: { en: "Thank you!" },
        } as TSurveyEndScreenCard,
      ],
      followUps: [],
      welcomeCard: { enabled: false, headline: { en: "" } } as unknown as TSurvey["welcomeCard"],
    } as unknown as TSurvey;

    const setLocalSurvey = vi.fn();
    const setActiveQuestionId = vi.fn();
    const selectedLanguageCode = "en";
    const setSelectedLanguageCode = vi.fn();
    const plan: TOrganizationBillingPlan = "free";
    const addEndingCard = vi.fn();
    const isFormbricksCloud = false;
    const locale: TUserLocale = "en-US";

    render(
      <EditEndingCard
        localSurvey={localSurvey}
        endingCardIndex={0}
        setLocalSurvey={setLocalSurvey}
        setActiveQuestionId={setActiveQuestionId}
        activeQuestionId={endingCardId}
        isInvalid={false}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        plan={plan}
        addEndingCard={addEndingCard}
        isFormbricksCloud={isFormbricksCloud}
        locale={locale}
      />
    );

    expect(screen.getByTestId("end-screen-form")).toBeInTheDocument();
  });
});
