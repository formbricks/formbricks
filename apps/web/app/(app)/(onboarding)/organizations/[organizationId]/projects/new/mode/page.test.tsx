import { getUserProjects } from "@/lib/project/service";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { getTranslate } from "@/tolgee/server";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import Page from "./page";

const mockTranslate = vi.fn((key) => key);

vi.mock("@/modules/organization/lib/utils", () => ({ getOrganizationAuth: vi.fn() }));
vi.mock("@/lib/project/service", () => ({ getUserProjects: vi.fn() }));
vi.mock("@/tolgee/server", () => ({ getTranslate: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer", () => ({
  OnboardingOptionsContainer: ({ options }: any) => (
    <div data-testid="options">{options.map((o: any) => o.title).join(",")}</div>
  ),
}));
vi.mock("@/modules/ui/components/header", () => ({ Header: ({ title }: any) => <h1>{title}</h1> }));
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

describe("Mode Page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const params = Promise.resolve({ organizationId: "org1" });

  test("redirects to login if no session user", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValueOnce({ session: {} } as any);
    await Page({ params });
    expect(redirect).toHaveBeenCalledWith("/auth/login");
  });

  test("renders header and options without close link when no projects", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValueOnce({ session: { user: { id: "u1" } } } as any);
    vi.mocked(getTranslate).mockResolvedValue(mockTranslate);
    vi.mocked(getUserProjects).mockResolvedValueOnce([] as any);

    const element = await Page({ params });
    render(element as React.ReactElement);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "organizations.projects.new.mode.what_are_you_here_for"
    );
    expect(screen.getByTestId("options")).toHaveTextContent(
      "organizations.projects.new.mode.formbricks_surveys," + "organizations.projects.new.mode.formbricks_cx"
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("renders close link when projects exist", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValueOnce({ session: { user: { id: "u1" } } } as any);
    vi.mocked(getTranslate).mockResolvedValue(mockTranslate);
    vi.mocked(getUserProjects).mockResolvedValueOnce([{ id: "p1" } as any]);

    const element = await Page({ params });
    render(element as React.ReactElement);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/");
  });
});
