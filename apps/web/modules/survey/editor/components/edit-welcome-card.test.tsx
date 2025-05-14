import { EditWelcomeCard } from "@/modules/survey/editor/components/edit-welcome-card";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";

vi.mock("@/lib/cn");

vi.mock("@/modules/ee/multi-language-surveys/components/localized-editor", () => ({
  LocalizedEditor: vi.fn(({ value, id }) => (
    <textarea data-testid={`localized-editor-${id}`} defaultValue={value?.default}></textarea>
  )),
}));

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: vi.fn(({ value, id }) => (
    <input data-testid={`question-form-input-${id}`} defaultValue={value?.default}></input>
  )),
}));

vi.mock("@/modules/ui/components/file-input", () => ({
  FileInput: vi.fn(({ fileUrl }) => <input data-testid="file-input" defaultValue={fileUrl}></input>),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/environments/test-env-id/surveys/survey-1/edit"),
}));

vi.mock("@radix-ui/react-collapsible", async () => {
  const original = await vi.importActual("@radix-ui/react-collapsible");
  return {
    ...original,
    Root: ({ children, open, onOpenChange }: any) => (
      <div data-state={open ? "open" : "closed"} onClick={() => onOpenChange(!open)}>
        {children}
      </div>
    ),
    CollapsibleTrigger: ({ children, asChild }: any) => (asChild ? children : <button>{children}</button>),
    CollapsibleContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  };
});

// create a mock survey object
const mockSurvey = {
  id: "survey-1",
  type: "web",
  title: "Test Survey",
  description: "This is a test survey.",
  languages: ["en"],
  questions: [],
} as unknown as TSurvey;

mockSurvey.welcomeCard = {
  enabled: true,
  headline: { default: "Welcome!" },
  html: { default: "<p>Thank you for participating.</p>" },
  buttonLabel: { default: "Start Survey" },
  timeToFinish: true,
  showResponseCount: false,
};

const mockSetLocalSurvey = vi.fn();
const mockSetActiveQuestionId = vi.fn();
const mockSetSelectedLanguageCode = vi.fn();

describe("EditWelcomeCard", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly when collapsed", () => {
    render(
      <EditWelcomeCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        setActiveQuestionId={mockSetActiveQuestionId}
        activeQuestionId={null}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
      />
    );

    expect(screen.getByText("common.welcome_card")).toBeInTheDocument();
    expect(screen.getByText("common.shown")).toBeInTheDocument();
    expect(screen.getByLabelText("common.on")).toBeInTheDocument();
    expect(screen.queryByLabelText("environments.surveys.edit.company_logo")).not.toBeInTheDocument();
  });

  test("renders correctly when expanded", () => {
    render(
      <EditWelcomeCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        setActiveQuestionId={mockSetActiveQuestionId}
        activeQuestionId="start"
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
      />
    );

    expect(screen.getByText("common.welcome_card")).toBeInTheDocument();
    expect(screen.queryByText("common.shown")).not.toBeInTheDocument();
    expect(screen.getByLabelText("common.on")).toBeInTheDocument();
    expect(screen.getByTestId("file-input")).toBeInTheDocument();
    expect(screen.getByTestId("question-form-input-headline")).toHaveValue("Welcome!");
    expect(screen.getByTestId("localized-editor-html")).toHaveValue("<p>Thank you for participating.</p>");
    expect(screen.getByTestId("question-form-input-buttonLabel")).toHaveValue("Start Survey");
    expect(screen.getByLabelText("common.time_to_finish")).toBeInTheDocument();
    const timeToFinishSwitch = screen.getAllByRole("switch")[1]; // Assuming the second switch is for timeToFinish
    expect(timeToFinishSwitch).toBeChecked();
  });

  test("calls setActiveQuestionId when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <EditWelcomeCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        setActiveQuestionId={mockSetActiveQuestionId}
        activeQuestionId={null} // Initially collapsed
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
      />
    );

    // Click the element containing the text, which will bubble up to the mocked Root div
    const triggerTextElement = screen.getByText("common.welcome_card");
    await user.click(triggerTextElement);

    // The mock's Root onClick calls onOpenChange(true), which calls setOpen(true), which calls setActiveQuestionId("start")
    expect(mockSetActiveQuestionId).toHaveBeenCalledWith("start");
  });

  test("toggles welcome card enabled state", async () => {
    const user = userEvent.setup();
    render(
      <EditWelcomeCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        setActiveQuestionId={mockSetActiveQuestionId}
        activeQuestionId="start"
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
      />
    );

    const enableToggle = screen.getAllByRole("switch")[0]; // First switch is the main toggle
    await user.click(enableToggle);

    expect(mockSetLocalSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        welcomeCard: expect.objectContaining({ enabled: false }),
      })
    );
  });

  test("toggles timeToFinish state", async () => {
    const user = userEvent.setup();
    render(
      <EditWelcomeCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        setActiveQuestionId={mockSetActiveQuestionId}
        activeQuestionId="start"
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
      />
    );

    const timeToFinishToggle = screen.getAllByRole("switch")[1]; // Second switch
    await user.click(timeToFinishToggle);

    expect(mockSetLocalSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        welcomeCard: expect.objectContaining({ timeToFinish: false }),
      })
    );
  });

  test("renders and toggles showResponseCount state for link surveys", async () => {
    const user = userEvent.setup();
    const linkSurvey = { ...mockSurvey, type: "link" as const };
    render(
      <EditWelcomeCard
        localSurvey={linkSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        setActiveQuestionId={mockSetActiveQuestionId}
        activeQuestionId="start"
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
      />
    );

    expect(screen.getByLabelText("common.show_response_count")).toBeInTheDocument();
    const showResponseCountToggle = screen.getAllByRole("switch")[2]; // Third switch for link survey
    expect(showResponseCountToggle).not.toBeChecked(); // Initial state from mock data

    await user.click(showResponseCountToggle);

    expect(mockSetLocalSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        welcomeCard: expect.objectContaining({ showResponseCount: true }),
      })
    );
  });

  test("does not render showResponseCount for non-link surveys", () => {
    const webSurvey = { ...mockSurvey, type: "web" as const } as unknown as TSurvey;
    render(
      <EditWelcomeCard
        localSurvey={webSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        setActiveQuestionId={mockSetActiveQuestionId}
        activeQuestionId="start"
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
      />
    );

    expect(screen.queryByLabelText("common.show_response_count")).not.toBeInTheDocument();
  });

  // Added test case for collapsing the card
  test("calls setActiveQuestionId with null when collapsing", async () => {
    const user = userEvent.setup();
    render(
      <EditWelcomeCard
        localSurvey={mockSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        setActiveQuestionId={mockSetActiveQuestionId}
        activeQuestionId="start" // Initially expanded
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
      />
    );

    // Click the element containing the text, which will bubble up to the mocked Root div
    const triggerTextElement = screen.getByText("common.welcome_card");
    await user.click(triggerTextElement);

    // The mock's Root onClick calls onOpenChange(false), which calls setOpen(false), which calls setActiveQuestionId(null)
    expect(mockSetActiveQuestionId).toHaveBeenCalledWith(null);
  });
});
