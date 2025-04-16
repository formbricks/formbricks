import { isSubmissionTimeMoreThan5Minutes } from "@/modules/analysis/components/SingleResponseCard/util";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { SingleResponseCardHeader } from "./SingleResponseCardHeader";

// Mocks
vi.mock("@/modules/ui/components/avatars", () => ({
  PersonAvatar: ({ personId }: any) => <div data-testid="PersonAvatar">Avatar: {personId}</div>,
}));
vi.mock("@/modules/ui/components/survey-status-indicator", () => ({
  SurveyStatusIndicator: ({ status }: any) => <div data-testid="SurveyStatusIndicator">Status: {status}</div>,
}));
vi.mock("@/modules/ui/components/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@formbricks/lib/i18n/utils", () => ({
  getLanguageLabel: vi.fn((lang, locale) => lang + "_" + locale),
}));
vi.mock("@/modules/lib/time", () => ({
  timeSince: vi.fn(() => "5 minutes ago"),
}));
vi.mock("@/modules/lib/utils/contact", () => ({
  getContactIdentifier: vi.fn((contact, attributes) => attributes?.email || contact?.userId || ""),
}));
vi.mock("../util", () => ({
  isSubmissionTimeMoreThan5Minutes: vi.fn(),
}));

describe("SingleResponseCardHeader", () => {
  afterEach(() => {
    cleanup();
  });

  const dummySurvey = {
    id: "survey1",
    name: "Test Survey",
    environmentId: "env1",
  } as TSurvey;
  const dummyResponse = {
    id: "resp1",
    finished: false,
    updatedAt: new Date("2023-01-01T12:00:00Z"),
    createdAt: new Date("2023-01-01T11:00:00Z"),
    language: "en",
    contact: { id: "contact1", name: "Alice" },
    contactAttributes: { attr: "value" },
    meta: {
      userAgent: { browser: "Chrome", os: "Windows", device: "PC" },
      url: "http://example.com",
      action: "click",
      source: "web",
      country: "USA",
    },
    singleUseId: "su123",
  } as unknown as TResponse;
  const dummyEnvironment = { id: "env1" } as TEnvironment;
  const dummyUser = { id: "user1", email: "user1@example.com" } as TUser;
  const dummyLocale = "en-US";

  test("renders response view with contact (user exists)", () => {
    vi.mocked(isSubmissionTimeMoreThan5Minutes).mockReturnValue(true);
    render(
      <SingleResponseCardHeader
        pageType="response"
        response={dummyResponse}
        survey={{ ...dummySurvey }}
        environment={dummyEnvironment}
        user={dummyUser}
        isReadOnly={false}
        setDeleteDialogOpen={vi.fn()}
        locale={dummyLocale}
      />
    );
    // Expect Link wrapping PersonAvatar and display identifier
    expect(screen.getByTestId("PersonAvatar")).toHaveTextContent("Avatar: contact1");
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  test("renders response view with no contact (anonymous)", () => {
    const responseNoContact = { ...dummyResponse, contact: null };
    render(
      <SingleResponseCardHeader
        pageType="response"
        response={responseNoContact}
        survey={{ ...dummySurvey }}
        environment={dummyEnvironment}
        user={dummyUser}
        isReadOnly={false}
        setDeleteDialogOpen={vi.fn()}
        locale={dummyLocale}
      />
    );
    expect(screen.getByText("common.anonymous")).toBeInTheDocument();
  });

  test("renders people view", () => {
    render(
      <SingleResponseCardHeader
        pageType="people"
        response={dummyResponse}
        survey={{ ...dummySurvey, type: "link" }}
        environment={dummyEnvironment}
        user={dummyUser}
        isReadOnly={false}
        setDeleteDialogOpen={vi.fn()}
        locale={dummyLocale}
      />
    );
    expect(screen.getByRole("link")).toBeInTheDocument();
    expect(screen.getByText("Test Survey")).toBeInTheDocument();
    expect(screen.getByTestId("SurveyStatusIndicator")).toBeInTheDocument();
  });

  test("renders language label when response.language is not default", () => {
    const modifiedResponse = { ...dummyResponse, language: "fr" };
    render(
      <SingleResponseCardHeader
        pageType="response"
        response={modifiedResponse}
        survey={{ ...dummySurvey }}
        environment={dummyEnvironment}
        user={dummyUser}
        isReadOnly={false}
        setDeleteDialogOpen={vi.fn()}
        locale={dummyLocale}
      />
    );
    expect(screen.getByText("fr_en-US")).toBeInTheDocument();
  });

  test("renders enabled trash icon and handles click", async () => {
    vi.mocked(isSubmissionTimeMoreThan5Minutes).mockReturnValue(true);
    const setDeleteDialogOpen = vi.fn();
    render(
      <SingleResponseCardHeader
        pageType="response"
        response={dummyResponse}
        survey={{ ...dummySurvey }}
        environment={dummyEnvironment}
        user={dummyUser}
        isReadOnly={false}
        setDeleteDialogOpen={setDeleteDialogOpen}
        locale={dummyLocale}
      />
    );
    const trashIcon = screen.getByLabelText("Delete response");
    await userEvent.click(trashIcon);
    expect(setDeleteDialogOpen).toHaveBeenCalledWith(true);
  });

  test("renders disabled trash icon when deletion not allowed", async () => {
    vi.mocked(isSubmissionTimeMoreThan5Minutes).mockReturnValue(false);
    render(
      <SingleResponseCardHeader
        pageType="response"
        response={dummyResponse}
        survey={{ ...dummySurvey }}
        environment={dummyEnvironment}
        user={dummyUser}
        isReadOnly={false}
        setDeleteDialogOpen={vi.fn()}
        locale={dummyLocale}
      />
    );
    const disabledTrash = screen.getByLabelText("Cannot delete response in progress");
    expect(disabledTrash).toBeInTheDocument();
  });
});
