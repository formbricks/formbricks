import { getProjectByEnvironmentId } from "@/lib/project/service";
import { getResponsesByContactId } from "@/lib/response/service";
import { getSurveys } from "@/lib/survey/service";
import { getUser } from "@/lib/user/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTranslate } from "@/tolgee/server";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TFnType } from "@tolgee/react";
import { getServerSession } from "next-auth";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TTag } from "@formbricks/types/tags";
import { ResponseSection } from "./response-section";

vi.mock("@/lib/project/service", () => ({
  getProjectByEnvironmentId: vi.fn(),
}));

vi.mock("@/lib/response/service", () => ({
  getResponsesByContactId: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({
  getSurveys: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("@/modules/ee/teams/lib/roles", () => ({
  getProjectPermissionByUserId: vi.fn(),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("./response-timeline", () => ({
  ResponseTimeline: () => <div data-testid="response-timeline">Response Timeline</div>,
}));

describe("ResponseSection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockEnvironment: TEnvironment = {
    id: "env1",
    createdAt: new Date(),
    updatedAt: new Date(),
    type: "development",
    projectId: "project1",
    appSetupCompleted: true,
  };

  const mockProps = {
    environment: mockEnvironment,
    contactId: "contact1",
    environmentTags: [] as TTag[],
  };

  test("renders ResponseTimeline component when all data is available", async () => {
    const mockSession = {
      user: { id: "user1" },
    };

    const mockUser = {
      id: "user1",
      name: "Test User",
      email: "test@example.com",
    };

    const mockResponses = [
      {
        id: "response1",
        surveyId: "survey1",
      },
    ];

    const mockSurveys = [
      {
        id: "survey1",
        name: "Test Survey",
      },
    ];

    const mockProject = {
      id: "project1",
    };

    const mockProjectPermission = {
      role: "owner",
    };

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
    vi.mocked(getUser).mockResolvedValue(mockUser as any);
    vi.mocked(getResponsesByContactId).mockResolvedValue(mockResponses as any);
    vi.mocked(getSurveys).mockResolvedValue(mockSurveys as any);
    vi.mocked(getProjectByEnvironmentId).mockResolvedValue(mockProject as any);
    vi.mocked(getProjectPermissionByUserId).mockResolvedValue(mockProjectPermission as any);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
    vi.mocked(getTranslate).mockResolvedValue({
      t: (key: string) => key,
    } as any);

    const { container } = render(await ResponseSection(mockProps));
    expect(screen.getByTestId("response-timeline")).toBeInTheDocument();
  });

  test("throws error when session is not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(getTranslate).mockResolvedValue(((key: string) => key) as TFnType);

    await expect(ResponseSection(mockProps)).rejects.toThrow("common.session_not_found");
  });

  test("throws error when user is not found", async () => {
    const mockSession = {
      user: { id: "user1" },
    };

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
    vi.mocked(getUser).mockResolvedValue(null);
    vi.mocked(getTranslate).mockResolvedValue(((key: string) => key) as TFnType);

    await expect(ResponseSection(mockProps)).rejects.toThrow("common.user_not_found");
  });

  test("throws error when no responses are found", async () => {
    const mockSession = {
      user: { id: "user1" },
    };

    const mockUser = {
      id: "user1",
      name: "Test User",
      email: "test@example.com",
    };

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
    vi.mocked(getUser).mockResolvedValue(mockUser as any);
    vi.mocked(getResponsesByContactId).mockResolvedValue(null);
    vi.mocked(getTranslate).mockResolvedValue(((key: string) => key) as TFnType);

    await expect(ResponseSection(mockProps)).rejects.toThrow("environments.contacts.no_responses_found");
  });

  test("throws error when project is not found", async () => {
    const mockSession = {
      user: { id: "user1" },
    };

    const mockUser = {
      id: "user1",
      name: "Test User",
      email: "test@example.com",
    };

    const mockResponses = [
      {
        id: "response1",
        surveyId: "survey1",
      },
    ];

    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
    vi.mocked(getUser).mockResolvedValue(mockUser as any);
    vi.mocked(getResponsesByContactId).mockResolvedValue(mockResponses as any);
    vi.mocked(getProjectByEnvironmentId).mockResolvedValue(null);
    vi.mocked(getTranslate).mockResolvedValue(((key: string) => key) as TFnType);

    await expect(ResponseSection(mockProps)).rejects.toThrow("common.project_not_found");
  });
});
