import { FileUploadSummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/FileUploadSummary";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TSurvey,
  TSurveyFileUploadQuestion,
  TSurveyQuestionSummaryFileUpload,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";

// Mock child components and hooks
vi.mock("@/modules/ui/components/avatars", () => ({
  PersonAvatar: vi.fn(() => <div>PersonAvatarMock</div>),
}));

vi.mock("./QuestionSummaryHeader", () => ({
  QuestionSummaryHeader: vi.fn(() => <div>QuestionSummaryHeaderMock</div>),
}));

// Mock utility functions
vi.mock("@/lib/storage/utils", () => ({
  getOriginalFileNameFromUrl: (url: string) => `original-${url.split("/").pop()}`,
}));

vi.mock("@/lib/time", () => ({
  timeSince: () => "some time ago",
}));

vi.mock("@/lib/utils/contact", () => ({
  getContactIdentifier: () => "contact@example.com",
}));

const environmentId = "test-env-id";
const survey = { id: "survey-1" } as TSurvey;
const locale = "en-US";

const createMockResponse = (id: string, value: string[], contactId: string | null = null) => ({
  id: `response-${id}`,
  value,
  updatedAt: new Date().toISOString(),
  contact: contactId ? { id: contactId, name: `Contact ${contactId}` } : null,
  contactAttributes: contactId ? { email: `contact${contactId}@example.com` } : {},
});

const questionSummaryBase = {
  question: {
    id: "q1",
    headline: { default: "Upload your file" },
    type: TSurveyQuestionTypeEnum.FileUpload,
  } as unknown as TSurveyFileUploadQuestion,
  responseCount: 0,
  files: [],
} as unknown as TSurveyQuestionSummaryFileUpload;

describe("FileUploadSummary", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the component with initial responses", () => {
    const files = Array.from({ length: 5 }, (_, i) =>
      createMockResponse(i.toString(), [`https://example.com/file${i}.pdf`], `contact-${i}`)
    );
    const questionSummary = {
      ...questionSummaryBase,
      files,
      responseCount: files.length,
    } as unknown as TSurveyQuestionSummaryFileUpload;

    render(
      <FileUploadSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    expect(screen.getByText("QuestionSummaryHeaderMock")).toBeInTheDocument();
    expect(screen.getByText("common.user")).toBeInTheDocument();
    expect(screen.getByText("common.response")).toBeInTheDocument();
    expect(screen.getByText("common.time")).toBeInTheDocument();
    expect(screen.getAllByText("PersonAvatarMock")).toHaveLength(5);
    expect(screen.getAllByText("contact@example.com")).toHaveLength(5);
    expect(screen.getByText("original-file0.pdf")).toBeInTheDocument();
    expect(screen.getByText("original-file4.pdf")).toBeInTheDocument();
    expect(screen.queryByText("common.load_more")).not.toBeInTheDocument();
  });

  test("renders 'Skipped' when value is an empty array", () => {
    const files = [createMockResponse("skipped", [], "contact-skipped")];
    const questionSummary = {
      ...questionSummaryBase,
      files,
      responseCount: files.length,
    } as unknown as TSurveyQuestionSummaryFileUpload;

    render(
      <FileUploadSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    expect(screen.getByText("common.skipped")).toBeInTheDocument();
    expect(screen.queryByText(/original-/)).not.toBeInTheDocument(); // No file name should be rendered
  });

  test("renders 'Anonymous' when contact is null", () => {
    const files = [createMockResponse("anon", ["https://example.com/anonfile.jpg"], null)];
    const questionSummary = {
      ...questionSummaryBase,
      files,
      responseCount: files.length,
    } as unknown as TSurveyQuestionSummaryFileUpload;

    render(
      <FileUploadSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    expect(screen.getByText("common.anonymous")).toBeInTheDocument();
    expect(screen.getByText("original-anonfile.jpg")).toBeInTheDocument();
  });

  test("shows 'Load More' button when there are more than 10 responses and loads more on click", async () => {
    const files = Array.from({ length: 15 }, (_, i) =>
      createMockResponse(i.toString(), [`https://example.com/file${i}.txt`], `contact-${i}`)
    );
    const questionSummary = {
      ...questionSummaryBase,
      files,
      responseCount: files.length,
    } as unknown as TSurveyQuestionSummaryFileUpload;

    render(
      <FileUploadSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    // Initially 10 responses should be visible
    expect(screen.getAllByText("PersonAvatarMock")).toHaveLength(10);
    expect(screen.getByText("original-file9.txt")).toBeInTheDocument();
    expect(screen.queryByText("original-file10.txt")).not.toBeInTheDocument();

    // "Load More" button should be visible
    const loadMoreButton = screen.getByText("common.load_more");
    expect(loadMoreButton).toBeInTheDocument();

    // Click "Load More"
    await userEvent.click(loadMoreButton);

    // Now all 15 responses should be visible
    expect(screen.getAllByText("PersonAvatarMock")).toHaveLength(15);
    expect(screen.getByText("original-file14.txt")).toBeInTheDocument();

    // "Load More" button should disappear
    expect(screen.queryByText("common.load_more")).not.toBeInTheDocument();
  });

  test("renders multiple files for a single response", () => {
    const files = [
      createMockResponse(
        "multi",
        ["https://example.com/fileA.png", "https://example.com/fileB.docx"],
        "contact-multi"
      ),
    ];
    const questionSummary = {
      ...questionSummaryBase,
      files,
      responseCount: files.length,
    } as unknown as TSurveyQuestionSummaryFileUpload;

    render(
      <FileUploadSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    expect(screen.getByText("original-fileA.png")).toBeInTheDocument();
    expect(screen.getByText("original-fileB.docx")).toBeInTheDocument();
    // Check that download links exist
    const links = screen.getAllByRole("link");
    // 1 contact link + 2 file links
    expect(links.filter((link) => link.getAttribute("target") === "_blank")).toHaveLength(2);
    expect(
      links.find((link) => link.getAttribute("href") === "https://example.com/fileA.png")
    ).toBeInTheDocument();
    expect(
      links.find((link) => link.getAttribute("href") === "https://example.com/fileB.docx")
    ).toBeInTheDocument();
  });

  test("renders contact link correctly", () => {
    const contactId = "contact-link-test";
    const files = [createMockResponse("link", ["https://example.com/link.pdf"], contactId)];
    const questionSummary = {
      ...questionSummaryBase,
      files,
      responseCount: files.length,
    } as unknown as TSurveyQuestionSummaryFileUpload;

    render(
      <FileUploadSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    const contactLink = screen.getByText("contact@example.com").closest("a");
    expect(contactLink).toBeInTheDocument();
    expect(contactLink).toHaveAttribute("href", `/environments/${environmentId}/contacts/${contactId}`);
  });
});
