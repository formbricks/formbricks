import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useTranslate } from "@tolgee/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser } from "@formbricks/types/user";
import { ResponseTimeline } from "./response-timeline";

vi.mock("@tolgee/react", () => ({
  useTranslate: vi.fn(),
}));

vi.mock("./response-feed", () => ({
  ResponseFeed: () => <div data-testid="response-feed">Response Feed</div>,
}));

describe("ResponseTimeline", () => {
  afterEach(() => {
    cleanup();
  });

  const mockUser: TUser = {
    id: "user1",
    name: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
    imageUrl: null,
    objective: null,
    role: "founder",
    email: "test@example.com",
    emailVerified: new Date(),
    twoFactorEnabled: false,
    identityProvider: "email",
    isActive: true,
    notificationSettings: {
      alert: {},
    },
    locale: "en-US",
    lastLoginAt: new Date(),
  };

  const mockResponse: TResponse = {
    id: "response1",
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: "survey1",
    contact: null,
    contactAttributes: null,
    finished: true,
    data: {},
    meta: {},
    variables: {},
    singleUseId: null,
    language: "en",
    ttc: {},
    notes: [],
    tags: [],
  };

  const mockEnvironment: TEnvironment = {
    id: "env1",
    createdAt: new Date(),
    updatedAt: new Date(),
    type: "development",
    projectId: "project1",
    appSetupCompleted: true,
  };

  const mockProps = {
    surveys: [] as TSurvey[],
    user: mockUser,
    responses: [mockResponse, { ...mockResponse, id: "response2" }],
    environment: mockEnvironment,
    environmentTags: [] as TTag[],
    locale: "en-US" as const,
    projectPermission: null as TTeamPermission | null,
  };

  test("renders the component with responses title", () => {
    vi.mocked(useTranslate).mockReturnValue({
      t: (key: string) => key,
    } as any);

    render(<ResponseTimeline {...mockProps} />);
    expect(screen.getByText("common.responses")).toBeInTheDocument();
  });

  test("renders ResponseFeed component", () => {
    vi.mocked(useTranslate).mockReturnValue({
      t: (key: string) => key,
    } as any);

    render(<ResponseTimeline {...mockProps} />);
    expect(screen.getByTestId("response-feed")).toBeInTheDocument();
  });
});
