import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TSurveyEndScreenCard, type TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";
import { EndingCard } from "./ending-card";

describe("EndingCard", () => {
  const mockSurvey: TJsEnvironmentStateSurvey = {
    id: "test-survey",
    type: "link",
  } as TJsEnvironmentStateSurvey;

  const mockEndScreenCard: TSurveyEndScreenCard = {
    id: "end-screen",
    type: "endScreen",
    headline: { default: "Thank you!" },
    subheader: { default: "Your response has been recorded." },
    buttonLabel: { default: "Close Survey" },
    buttonLink: "https://example.com",
    imageUrl: undefined,
    videoUrl: undefined,
  };

  const mockRedirectCard: TSurveyRedirectUrlCard = {
    id: "redirect",
    type: "redirectToUrl",
    url: "https://example.com/redirect",
  };

  const mockResponseData: TResponseData = {};
  const mockVariablesData: TResponseVariables = {};
  const mockOnOpenExternalURL = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders end screen card with correct content", () => {
    render(
      <EndingCard
        survey={mockSurvey}
        endingCard={mockEndScreenCard}
        isRedirectDisabled={false}
        isResponseSendingFinished={true}
        autoFocusEnabled={false}
        isCurrent={true}
        languageCode="en"
        responseData={mockResponseData}
        variablesData={mockVariablesData}
        onOpenExternalURL={mockOnOpenExternalURL}
        isPreviewMode={false}
      />
    );

    expect(screen.getByText("Thank you!")).toBeInTheDocument();
    expect(screen.getByText("Your response has been recorded.")).toBeInTheDocument();
    expect(screen.getByText("Close Survey")).toBeInTheDocument();
  });

  test("shows loading state when response is not finished sending", () => {
    render(
      <EndingCard
        survey={mockSurvey}
        endingCard={mockEndScreenCard}
        isRedirectDisabled={false}
        isResponseSendingFinished={false}
        autoFocusEnabled={false}
        isCurrent={true}
        languageCode="en"
        responseData={mockResponseData}
        variablesData={mockVariablesData}
        onOpenExternalURL={mockOnOpenExternalURL}
        isPreviewMode={false}
      />
    );

    expect(screen.getByText("Sending responses...")).toBeInTheDocument();
  });

  test("calls onOpenExternalURL when button is clicked", async () => {
    render(
      <EndingCard
        survey={mockSurvey}
        endingCard={mockEndScreenCard}
        isRedirectDisabled={false}
        isResponseSendingFinished={true}
        autoFocusEnabled={false}
        isCurrent={true}
        languageCode="en"
        responseData={mockResponseData}
        variablesData={mockVariablesData}
        onOpenExternalURL={mockOnOpenExternalURL}
        isPreviewMode={false}
      />
    );

    const button = screen.getByText("Close Survey");
    await userEvent.click(button);

    expect(mockOnOpenExternalURL).toHaveBeenCalledWith("https://example.com");
  });

  test("shows preview message for redirect card in preview mode", () => {
    render(
      <EndingCard
        survey={mockSurvey}
        endingCard={mockRedirectCard}
        isRedirectDisabled={false}
        isResponseSendingFinished={true}
        autoFocusEnabled={false}
        isCurrent={true}
        languageCode="en"
        responseData={mockResponseData}
        variablesData={mockVariablesData}
        onOpenExternalURL={mockOnOpenExternalURL}
        isPreviewMode={true}
      />
    );

    expect(screen.getByText("Respondents will not see this card")).toBeInTheDocument();
    expect(screen.getByText("They will be redirected immediately")).toBeInTheDocument();
  });

  test("handles Enter key press for link surveys", async () => {
    render(
      <EndingCard
        survey={mockSurvey}
        endingCard={mockEndScreenCard}
        isRedirectDisabled={false}
        isResponseSendingFinished={true}
        autoFocusEnabled={false}
        isCurrent={true}
        languageCode="en"
        responseData={mockResponseData}
        variablesData={mockVariablesData}
        onOpenExternalURL={mockOnOpenExternalURL}
        isPreviewMode={false}
      />
    );

    await userEvent.keyboard("{Enter}");
    expect(mockOnOpenExternalURL).toHaveBeenCalledWith("https://example.com");
  });

  test("handles media content in end screen card", () => {
    const cardWithMedia: TSurveyEndScreenCard = {
      ...mockEndScreenCard,
      imageUrl: "https://example.com/image.jpg",
    };

    render(
      <EndingCard
        survey={mockSurvey}
        endingCard={cardWithMedia}
        isRedirectDisabled={false}
        isResponseSendingFinished={true}
        autoFocusEnabled={false}
        isCurrent={true}
        languageCode="en"
        responseData={mockResponseData}
        variablesData={mockVariablesData}
        onOpenExternalURL={mockOnOpenExternalURL}
        isPreviewMode={false}
      />
    );

    const image = screen.getByRole("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "https://example.com/image.jpg");
  });
});
