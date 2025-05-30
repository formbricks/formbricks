import { TFollowUpEmailToUser } from "@/modules/survey/editor/types/survey-follow-up";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { FollowUpModal } from "./follow-up-modal";

// Mock react-hook-form
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    formState: {
      errors: {},
      isSubmitting: false,
    },
    watch: vi.fn(),
    setError: vi.fn(),
    handleSubmit: (fn: any) => fn,
    reset: vi.fn(),
    getValues: vi.fn(),
    setValue: vi.fn(),
    register: vi.fn(),
    clearErrors: vi.fn(),
  }),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock isomorphic-dompurify
vi.mock("isomorphic-dompurify", () => ({
  default: {
    sanitize: (input: string) => input,
  },
}));

// Mock the useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the Editor component
vi.mock("@/modules/ui/components/editor", () => ({
  Editor: ({ getText, setText, placeholder }: any) => (
    <div data-testid="editor">
      <textarea
        data-testid="editor-textarea"
        value={getText()}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

// Mock the Select component
vi.mock("@/modules/ui/components/select", () => ({
  Select: ({ children, defaultValue, onValueChange }: any) => (
    <div data-testid="select">
      <select
        data-testid="select-native"
        defaultValue={defaultValue}
        onChange={(e) => onValueChange?.(e.target.value)}>
        {children}
      </select>
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: () => <div data-testid="select-value" />,
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  ),
}));

// Mock the FollowUpActionMultiEmailInput component
vi.mock("./follow-up-action-multi-email-input", () => ({
  default: ({ emails, setEmails }: any) => (
    <div data-testid="multi-email-input">
      <input
        data-testid="email-input"
        value={emails.join(", ")}
        onChange={(e) => setEmails(e.target.value.split(", "))}
      />
    </div>
  ),
}));

// Mock the Dialog components
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-header" className={className}>
      {children}
    </div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogBody: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-body" className={className}>
      {children}
    </div>
  ),
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-footer" className={className}>
      {children}
    </div>
  ),
}));

// Mock the Form components
vi.mock("@/modules/ui/components/form", () => ({
  FormProvider: ({ children }: any) => <div data-testid="form-provider">{children}</div>,
  FormField: ({ children }: any) => <div data-testid="form-field">{children}</div>,
  FormItem: ({ children }: any) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children }: any) => <label data-testid="form-label">{children}</label>,
  FormControl: ({ children }: any) => <div data-testid="form-control">{children}</div>,
  FormDescription: ({ children }: any) => <div data-testid="form-description">{children}</div>,
}));

describe("FollowUpModal", () => {
  afterEach(() => {
    cleanup();
  });

  const mockSurvey: TSurvey = {
    id: "survey-1",
    name: "Test Survey",
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "draft",
    questions: [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "What would you like to know?",
        },
        required: true,
        charLimit: {},
        inputType: "email",
        longAnswer: false,
        buttonLabel: {
          default: "Next",
        },
        placeholder: {
          default: "example@email.com",
        },
      },
    ],
    hiddenFields: {
      enabled: true,
      fieldIds: ["hidden1"],
    },
    endings: [],
    followUps: [],
  } as unknown as TSurvey;

  const mockTeamMemberDetails: TFollowUpEmailToUser[] = [
    { email: "team1@example.com", name: "Team 1" },
    { email: "team2@example.com", name: "Team 2" },
  ];

  const defaultProps = {
    localSurvey: mockSurvey,
    open: true,
    setOpen: vi.fn(),
    selectedLanguageCode: "default",
    mailFrom: "noreply@example.com",
    userEmail: "user@example.com",
    teamMemberDetails: mockTeamMemberDetails,
    setLocalSurvey: vi.fn(),
    locale: "en-US" as TUserLocale,
  };

  test("renders modal with create heading when mode is create", () => {
    render(<FollowUpModal {...defaultProps} />);
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.follow_ups_modal_create_heading")).toBeInTheDocument();
  });

  test("renders modal with edit heading when mode is edit", () => {
    render(
      <FollowUpModal
        {...defaultProps}
        mode="edit"
        defaultValues={{
          surveyFollowUpId: "followup-1",
          followUpName: "Test Follow-up",
          triggerType: "response",
          emailTo: "q1",
          replyTo: ["user@example.com"],
          subject: "Test Subject",
          body: "Test Body",
          attachResponseData: false,
        }}
      />
    );

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.follow_ups_modal_edit_heading")).toBeInTheDocument();
  });

  test("renders form fields in create mode", () => {
    render(<FollowUpModal {...defaultProps} />);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.follow_ups_modal_trigger_label")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.follow_ups_modal_action_label")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.follow_ups_modal_action_email_settings")
    ).toBeInTheDocument();
  });
});
