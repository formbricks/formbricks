import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type TSurveyFileUploadQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { FileUploadQuestion } from "./file-upload-question";

vi.mock("@/components/buttons/submit-button", () => ({
  SubmitButton: ({ buttonLabel, tabIndex }: any) => (
    <button data-testid="submit-button" tabIndex={tabIndex}>
      {buttonLabel}
    </button>
  ),
}));

vi.mock("@/components/general/headline", () => ({
  Headline: ({ headline, required }: any) => (
    <h2 data-testid="headline" data-required={required}>
      {headline}
    </h2>
  ),
}));

vi.mock("@/components/general/subheader", () => ({
  Subheader: ({ subheader }: any) => <p data-testid="subheader">{subheader}</p>,
}));

vi.mock("@/components/general/question-media", () => ({
  QuestionMedia: ({ imgUrl, videoUrl }: any) => (
    <div data-testid="question-media" data-img-url={imgUrl} data-video-url={videoUrl}></div>
  ),
}));

vi.mock("@/components/wrappers/scrollable-container", () => ({
  ScrollableContainer: ({ children }: any) => <div data-testid="scrollable-container">{children}</div>,
}));

vi.mock("@/components/buttons/back-button", () => ({
  BackButton: ({ backButtonLabel, onClick, tabIndex }: any) => (
    <button data-testid="back-button" onClick={onClick} tabIndex={tabIndex}>
      {backButtonLabel}
    </button>
  ),
}));

vi.mock("@/components/general/file-input", () => ({
  FileInput: ({ onUploadCallback, fileUrls }: any) => (
    <div data-testid="file-input">
      <button data-testid="upload-button" onClick={() => onUploadCallback(["file-url-1"])}>
        Upload
      </button>
      <div data-testid="file-urls">{fileUrls ? fileUrls.join(",") : ""}</div>
    </div>
  ),
}));

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: (value: any, language?: string) => {
    if (typeof value === "string") return value;
    if (value?.default) return value.default;
    return value?.[language ?? "en"] ?? "";
  },
}));

vi.mock("@/lib/ttc", () => ({
  useTtc: vi.fn(),
  getUpdatedTtc: (ttc: any, id: string) => ({ ...ttc, [id]: 1000 }),
}));

// Mock window.alert before tests
Object.defineProperty(window, "alert", {
  writable: true,
  value: vi.fn(),
});

describe("FileUploadQuestion", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockQuestion: TSurveyFileUploadQuestion = {
    id: "q1",
    type: TSurveyQuestionTypeEnum.FileUpload,
    headline: { default: "Upload your file" },
    subheader: { default: "Please upload a relevant file" },
    required: true,
    buttonLabel: { default: "Submit" },
    backButtonLabel: { default: "Back" },
    allowMultipleFiles: false,
  };

  const defaultProps = {
    question: mockQuestion,
    value: [],
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onBack: vi.fn(),
    onFileUpload: vi.fn().mockResolvedValue("uploaded-file-url"),
    isFirstQuestion: false,
    isLastQuestion: false,
    surveyId: "survey123",
    languageCode: "en",
    ttc: {},
    setTtc: vi.fn(),
    autoFocusEnabled: true,
    currentQuestionId: "q1",
    isBackButtonHidden: false,
  };

  test("renders correctly with all elements", () => {
    render(<FileUploadQuestion {...defaultProps} />);

    expect(screen.getByTestId("headline")).toHaveTextContent("Upload your file");
    expect(screen.getByTestId("subheader")).toHaveTextContent("Please upload a relevant file");
    expect(screen.getByTestId("submit-button")).toBeInTheDocument();
    expect(screen.getByTestId("back-button")).toBeInTheDocument();
    expect(screen.getByTestId("file-input")).toBeInTheDocument();
  });

  test("renders with media when available", () => {
    const questionWithMedia = {
      ...mockQuestion,
      imageUrl: "image-url.jpg",
    };

    render(<FileUploadQuestion {...defaultProps} question={questionWithMedia} />);

    expect(screen.getByTestId("question-media")).toBeInTheDocument();
    expect(screen.getByTestId("question-media")).toHaveAttribute("data-img-url", "image-url.jpg");
  });

  test("does not render media when not available", () => {
    render(<FileUploadQuestion {...defaultProps} />);

    expect(screen.queryByTestId("question-media")).not.toBeInTheDocument();
  });

  test("hides back button when isFirstQuestion is true", () => {
    render(<FileUploadQuestion {...defaultProps} isFirstQuestion={true} />);

    expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
  });

  test("hides back button when isBackButtonHidden is true", () => {
    render(<FileUploadQuestion {...defaultProps} isBackButtonHidden={true} />);

    expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
  });

  test("calls onBack when back button is clicked", async () => {
    const onBackMock = vi.fn();
    render(<FileUploadQuestion {...defaultProps} onBack={onBackMock} />);

    await userEvent.click(screen.getByTestId("back-button"));

    expect(onBackMock).toHaveBeenCalledTimes(1);
  });

  test("calls onChange when file is uploaded", async () => {
    const onChangeMock = vi.fn();
    render(<FileUploadQuestion {...defaultProps} onChange={onChangeMock} />);

    await userEvent.click(screen.getByTestId("upload-button"));

    expect(onChangeMock).toHaveBeenCalledWith({ q1: ["file-url-1"] });
  });

  test("calls onSubmit with value when form is submitted with valid data", () => {
    const onSubmitMock = vi.fn();
    const setTtcMock = vi.fn();

    global.performance.now = vi.fn().mockReturnValue(1000);

    const { container } = render(
      <FileUploadQuestion
        {...defaultProps}
        onSubmit={onSubmitMock}
        setTtc={setTtcMock}
        value={["file-url-1"]}
      />
    );

    const form = container.querySelector("form");
    fireEvent.submit(form as HTMLFormElement);

    expect(setTtcMock).toHaveBeenCalled();
    expect(onSubmitMock).toHaveBeenCalledWith({ q1: ["file-url-1"] }, expect.any(Object));
  });

  test("shows alert when submitting without a file for required question", () => {
    const onSubmitMock = vi.fn();

    const { container } = render(<FileUploadQuestion {...defaultProps} onSubmit={onSubmitMock} value={[]} />);

    const form = container.querySelector("form");
    fireEvent.submit(form as HTMLFormElement);

    expect(window.alert).toHaveBeenCalledWith("Please upload a file");
    expect(onSubmitMock).not.toHaveBeenCalled();
  });

  test("submits with empty array when question is not required and no file provided", () => {
    const onSubmitMock = vi.fn();
    const questionNotRequired = { ...mockQuestion, required: false };

    const { container } = render(
      <FileUploadQuestion
        {...defaultProps}
        onSubmit={onSubmitMock}
        question={questionNotRequired}
        value={[]}
      />
    );

    const form = container.querySelector("form");
    fireEvent.submit(form as HTMLFormElement);

    expect(onSubmitMock).toHaveBeenCalledWith({ q1: [] }, { q1: 1000 });
  });

  test("sets tabIndex correctly based on current question", () => {
    render(<FileUploadQuestion {...defaultProps} currentQuestionId="q1" />);

    expect(screen.getByTestId("submit-button")).toHaveAttribute("tabIndex", "0");
    expect(screen.getByTestId("back-button")).toHaveAttribute("tabIndex", "0");

    cleanup();

    render(<FileUploadQuestion {...defaultProps} currentQuestionId="different-id" />);

    expect(screen.getByTestId("submit-button")).toHaveAttribute("tabIndex", "-1");
    expect(screen.getByTestId("back-button")).toHaveAttribute("tabIndex", "-1");
  });
});
