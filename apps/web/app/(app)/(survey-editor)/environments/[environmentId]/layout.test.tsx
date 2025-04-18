import { environmentIdLayoutChecks } from "@/modules/environments/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import { Session } from "next-auth";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import SurveyEditorEnvironmentLayout from "./layout";

// Mock sub-components to render identifiable elements
vi.mock("@/modules/ui/components/environmentId-base-layout", () => ({
  EnvironmentIdBaseLayout: ({ children, environmentId }: any) => (
    <div data-testid="EnvironmentIdBaseLayout">
      {environmentId}
      {children}
    </div>
  ),
}));
vi.mock("@/modules/ui/components/dev-environment-banner", () => ({
  DevEnvironmentBanner: ({ environment }: any) => (
    <div data-testid="DevEnvironmentBanner">{environment.id}</div>
  ),
}));

// Mocks for dependencies
vi.mock("@/modules/environments/lib/utils", () => ({
  environmentIdLayoutChecks: vi.fn(),
}));
vi.mock("@formbricks/lib/environment/service", () => ({
  getEnvironment: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("SurveyEditorEnvironmentLayout", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders successfully when environment is found", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: ((key: string) => key) as any, // Mock translation function, we don't need to implement it for the test
      session: { user: { id: "user1" } } as Session,
      user: { id: "user1", email: "user1@example.com" } as TUser,
      organization: { id: "org1", name: "Org1", billing: {} } as TOrganization,
    });
    vi.mocked(getEnvironment).mockResolvedValueOnce({ id: "env1" } as TEnvironment);

    const result = await SurveyEditorEnvironmentLayout({
      params: Promise.resolve({ environmentId: "env1" }),
      children: <div data-testid="child">Survey Editor Content</div>,
    });

    render(result);

    expect(screen.getByTestId("EnvironmentIdBaseLayout")).toHaveTextContent("env1");
    expect(screen.getByTestId("DevEnvironmentBanner")).toHaveTextContent("env1");
    expect(screen.getByTestId("child")).toHaveTextContent("Survey Editor Content");
  });

  test("throws an error when environment is not found", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: ((key: string) => key) as any,
      session: { user: { id: "user1" } } as Session,
      user: { id: "user1", email: "user1@example.com" } as TUser,
      organization: { id: "org1", name: "Org1", billing: {} } as TOrganization,
    });
    vi.mocked(getEnvironment).mockResolvedValueOnce(null);

    await expect(
      SurveyEditorEnvironmentLayout({
        params: Promise.resolve({ environmentId: "env1" }),
        children: <div>Content</div>,
      })
    ).rejects.toThrow("common.environment_not_found");
  });

  test("calls redirect when session is null", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: ((key: string) => key) as any,
      session: undefined as unknown as Session,
      user: undefined as unknown as TUser,
      organization: { id: "org1", name: "Org1", billing: {} } as TOrganization,
    });
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("Redirect called");
    });

    await expect(
      SurveyEditorEnvironmentLayout({
        params: Promise.resolve({ environmentId: "env1" }),
        children: <div>Content</div>,
      })
    ).rejects.toThrow("Redirect called");
  });

  test("throws error if user is null", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: ((key: string) => key) as any,
      session: { user: { id: "user1" } } as Session,
      user: undefined as unknown as TUser,
      organization: { id: "org1", name: "Org1", billing: {} } as TOrganization,
    });

    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("Redirect called");
    });

    await expect(
      SurveyEditorEnvironmentLayout({
        params: Promise.resolve({ environmentId: "env1" }),
        children: <div>Content</div>,
      })
    ).rejects.toThrow("common.user_not_found");
  });
});
