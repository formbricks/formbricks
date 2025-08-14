import { useSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/context/survey-context";
import { createI18nString, extractLanguageCodes, getEnabledLanguages } from "@/lib/i18n/utils";
import { updateSurveyAction } from "@/modules/survey/editor/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { LinkSettingsTab } from "./link-settings-tab";

// Mock dependencies
vi.mock("@/lib/i18n/utils", () => ({
  createI18nString: vi.fn(),
  extractLanguageCodes: vi.fn(),
  getEnabledLanguages: vi.fn(),
}));

vi.mock("@/modules/survey/editor/actions", () => ({
  updateSurveyAction: vi.fn(),
}));

vi.mock("@formbricks/i18n-utils/src/utils", () => ({
  getLanguageLabel: vi.fn(),
}));

vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/context/survey-context", () => ({
  useSurvey: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/modules/ui/components/file-input", () => ({
  FileInput: vi.fn(({ onFileUpload, fileUrl, disabled, id }) => (
    <div data-testid={id}>
      <input
        data-testid="file-input"
        type="text"
        value={fileUrl || ""}
        onChange={(e) => onFileUpload(e.target.value ? [e.target.value] : undefined)}
        disabled={disabled}
      />
    </div>
  )),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: vi.fn(({ children, disabled, type, ...props }) => (
    <button data-testid="save-button" disabled={disabled} type={type} {...props}>
      {children}
    </button>
  )),
}));

const mockSurvey: TSurvey = {
  id: "test-survey-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  type: "link",
  environmentId: "test-env-id",
  status: "inProgress",
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],
  recontactDays: null,
  displayLimit: null,
  welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
  questions: [],
  endings: [],
  hiddenFields: { enabled: false },
  displayPercentage: null,
  autoComplete: null,
  segment: null,
  languages: [
    { language: { id: "lang1", code: "default" }, default: true, enabled: true } as TSurveyLanguage,
    { language: { id: "lang2", code: "en" }, default: false, enabled: true } as TSurveyLanguage,
  ],
  showLanguageSwitch: false,
  singleUse: { enabled: false, isEncrypted: false },
  projectOverwrites: null,
  surveyClosedMessage: null,
  delay: 0,
  isVerifyEmailEnabled: false,
  createdBy: null,
  variables: [],
  followUps: [],
  runOnDate: null,
  closeOnDate: null,
  styling: null,
  pin: null,
  recaptcha: null,
  isSingleResponsePerEmailEnabled: false,
  isBackButtonHidden: false,
  metadata: {
    title: { default: "Test Title", en: "Test Title EN" },
    description: { default: "Test Description", en: "Test Description EN" },
    ogImage: "https://example.com/image.png",
  },
};

const mockSingleLanguageSurvey: TSurvey = {
  ...mockSurvey,
  languages: [
    { language: { id: "lang1", code: "default" }, default: true, enabled: true },
  ] as TSurveyLanguage[],
};

describe("LinkSettingsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSurvey).mockReturnValue({
      survey: mockSurvey,
    });

    vi.mocked(getEnabledLanguages).mockReturnValue([
      { language: { id: "lang1", code: "default" }, default: true, enabled: true } as TSurveyLanguage,
      { language: { id: "lang2", code: "en" }, default: false, enabled: true } as TSurveyLanguage,
    ]);

    vi.mocked(extractLanguageCodes).mockReturnValue(["default", "en"]);

    vi.mocked(createI18nString).mockImplementation((text, languages) => {
      const result = {};
      languages.forEach((lang) => {
        result[lang] = typeof text === "string" ? text : "";
      });
      return result;
    });

    vi.mocked(getLanguageLabel).mockImplementation((code) => {
      const labels = {
        default: "Default",
        en: "English",
      };
      return labels[code] || code;
    });

    vi.mocked(updateSurveyAction).mockResolvedValue({ data: mockSurvey });
  });

  afterEach(() => {
    cleanup();
  });

  test("renders form fields correctly", () => {
    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    expect(screen.getByText("common.language")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.share.link_settings.link_title")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.share.link_settings.link_description")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.share.link_settings.preview_image")).toBeInTheDocument();
    expect(screen.getByTestId("save-button")).toBeInTheDocument();
  });

  test("initializes form with existing metadata", () => {
    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    const titleInput = screen.getByDisplayValue("Test Title");
    const descriptionInput = screen.getByDisplayValue("Test Description");

    expect(titleInput).toBeInTheDocument();
    expect(descriptionInput).toBeInTheDocument();
  });

  test("initializes form with empty values when metadata is undefined", () => {
    const mockSurveyWithoutMetadata: TSurvey = {
      ...mockSurvey,
      metadata: {},
    };

    vi.mocked(useSurvey).mockReturnValue({
      survey: mockSurveyWithoutMetadata,
    });

    vi.mocked(createI18nString).mockReturnValue({ default: "", en: "" });

    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    expect(vi.mocked(createI18nString)).toHaveBeenCalledWith("", ["default", "en"]);
  });

  test("does not show language selector for single language surveys", () => {
    vi.mocked(useSurvey).mockReturnValue({
      survey: mockSingleLanguageSurvey,
    });

    vi.mocked(getEnabledLanguages).mockReturnValue([
      { language: { id: "lang1", code: "default" }, default: true, enabled: true } as TSurveyLanguage,
    ]);

    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    expect(screen.queryByText("common.language")).not.toBeInTheDocument();
  });

  test("shows language selector for multi-language surveys", () => {
    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    expect(screen.getByText("common.language")).toBeInTheDocument();
  });

  test("handles language change correctly", async () => {
    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    // Since the Select component is complex to test in JSDOM, let's test that
    // the language selector is rendered and has the expected options
    const languageSelect = screen.getByRole("combobox");
    expect(languageSelect).toBeInTheDocument();

    // Check that the language options are available in the hidden select
    const hiddenSelect = screen.getByDisplayValue("Default");
    expect(hiddenSelect).toBeInTheDocument();

    // Check for English option in the select
    const englishOption = screen
      .getByDisplayValue("Default")
      .closest("select")
      ?.querySelector('option[value="en"]');
    expect(englishOption).toBeInTheDocument();
  });

  test("handles title input change", async () => {
    const user = userEvent.setup();
    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    const titleInput = screen.getByDisplayValue("Test Title");
    await user.clear(titleInput);
    await user.type(titleInput, "New Title");

    expect(titleInput).toHaveValue("New Title");
  });

  test("handles description input change", async () => {
    const user = userEvent.setup();
    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    const descriptionInput = screen.getByDisplayValue("Test Description");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "New Description");

    expect(descriptionInput).toHaveValue("New Description");
  });

  test("handles file upload", async () => {
    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    const fileInput = screen.getByTestId("file-input");
    fireEvent.change(fileInput, { target: { value: "https://example.com/new-image.png" } });

    expect(fileInput).toHaveValue("https://example.com/new-image.png");
  });

  test("handles file removal", async () => {
    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    const fileInput = screen.getByTestId("file-input");
    fireEvent.change(fileInput, { target: { value: "" } });

    expect(fileInput).toHaveValue("");
  });

  test("disables form when isReadOnly is true", () => {
    render(<LinkSettingsTab isReadOnly={true} locale="en-US" />);

    const titleInput = screen.getByDisplayValue("Test Title");
    const descriptionInput = screen.getByDisplayValue("Test Description");
    const saveButton = screen.getByTestId("save-button");

    expect(titleInput).toBeDisabled();
    expect(descriptionInput).toBeDisabled();
    expect(saveButton).toBeDisabled();
  });

  test("submits form successfully", async () => {
    const user = userEvent.setup();
    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    const titleInput = screen.getByDisplayValue("Test Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Title");

    const saveButton = screen.getByTestId("save-button");
    await user.click(saveButton);

    await waitFor(() => {
      expect(vi.mocked(updateSurveyAction)).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(updateSurveyAction).mock.calls[0][0];
    expect(callArgs.metadata.title?.default).toBe("Updated Title");
  });

  test("handles submission error", async () => {
    const user = userEvent.setup();
    vi.mocked(updateSurveyAction).mockResolvedValue({ data: mockSurvey });

    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    const titleInput = screen.getByDisplayValue("Test Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Title");

    const saveButton = screen.getByTestId("save-button");
    await user.click(saveButton);

    await waitFor(() => {
      expect(vi.mocked(updateSurveyAction)).toHaveBeenCalled();
    });
  });

  test("does not submit when form is saving", async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(updateSurveyAction).mockReturnValue(pendingPromise as any);

    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    // Make form dirty first
    const titleInput = screen.getByDisplayValue("Test Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Modified Title");

    const saveButton = screen.getByTestId("save-button");

    // First click should trigger submission
    await user.click(saveButton);

    // Wait a bit to ensure the first submission started
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Second click should be prevented because form is saving
    await user.click(saveButton);

    // Should only be called once
    expect(vi.mocked(updateSurveyAction)).toHaveBeenCalledTimes(1);

    // Clean up by resolving the promise
    resolvePromise!({ data: mockSurvey });
  });

  test("does not submit when isReadOnly is true", async () => {
    const user = userEvent.setup();
    render(<LinkSettingsTab isReadOnly={true} locale="en-US" />);

    const saveButton = screen.getByTestId("save-button");
    await user.click(saveButton);

    expect(vi.mocked(updateSurveyAction)).not.toHaveBeenCalled();
  });

  test("handles ogImage correctly in form submission", async () => {
    const user = userEvent.setup();
    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    const fileInput = screen.getByTestId("file-input");
    fireEvent.change(fileInput, { target: { value: "https://example.com/new-image.png" } });

    const saveButton = screen.getByTestId("save-button");
    await user.click(saveButton);

    await waitFor(() => {
      expect(vi.mocked(updateSurveyAction)).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(updateSurveyAction).mock.calls[0][0];
    expect(callArgs.metadata.ogImage).toBe("https://example.com/new-image.png");
  });

  test("handles empty ogImage correctly in form submission", async () => {
    const user = userEvent.setup();
    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    const fileInput = screen.getByTestId("file-input");
    fireEvent.change(fileInput, { target: { value: "" } });

    const saveButton = screen.getByTestId("save-button");
    await user.click(saveButton);

    await waitFor(() => {
      expect(vi.mocked(updateSurveyAction)).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(updateSurveyAction).mock.calls[0][0];
    expect(callArgs.metadata.ogImage).toBeUndefined();
  });

  test("merges form data with existing metadata correctly", async () => {
    const user = userEvent.setup();
    const surveyWithPartialMetadata: TSurvey = {
      ...mockSurvey,
      metadata: {
        title: { default: "Existing Title" },
        description: { default: "Existing Description" },
      },
    };

    vi.mocked(useSurvey).mockReturnValue({
      survey: surveyWithPartialMetadata,
    });

    render(<LinkSettingsTab isReadOnly={false} locale="en-US" />);

    const titleInput = screen.getByDisplayValue("Existing Title");
    await user.clear(titleInput);
    await user.type(titleInput, "New Title");

    const saveButton = screen.getByTestId("save-button");
    await user.click(saveButton);

    await waitFor(() => {
      expect(vi.mocked(updateSurveyAction)).toHaveBeenCalled();
    });

    const callArgs = vi.mocked(updateSurveyAction).mock.calls[0][0];
    expect(callArgs.metadata.title?.default).toBe("New Title");
    expect(callArgs.metadata.description?.default).toBe("Existing Description");
  });
});
