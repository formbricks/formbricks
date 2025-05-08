import { getUserProjects } from "@/lib/project/service";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { getTranslate } from "@/tolgee/server";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import Page from "./page";

const mockTranslate = vi.fn((key) => key);

// Module mocks must be declared before importing the component
vi.mock("@/lib/project/service", () => ({ getUserProjects: vi.fn() }));
vi.mock("@/modules/organization/lib/utils", () => ({ getOrganizationAuth: vi.fn() }));
vi.mock("@/tolgee/server", () => ({ getTranslate: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => "REDIRECT_STUB") }));
vi.mock("@/modules/ui/components/header", () => ({
  Header: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));
vi.mock("@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer", () => ({
  OnboardingOptionsContainer: ({ options }: { options: any[] }) => (
    <div data-testid="options">{options.map((o) => o.title).join(",")}</div>
  ),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

describe("Page component", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const params = Promise.resolve({ organizationId: "org1" });

  test("redirects to login if no user session", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValue({ session: {} } as any);

    const result = await Page({ params });

    expect(redirect).toHaveBeenCalledWith("/auth/login");
    expect(result).toBe("REDIRECT_STUB");
  });

  test("renders header, options, and close button when projects exist", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValue({ session: { user: { id: "user1" } } } as any);
    vi.mocked(getTranslate).mockResolvedValue(mockTranslate);
    vi.mocked(getUserProjects).mockResolvedValue([{ id: 1 }] as any);

    const element = await Page({ params });
    render(element as React.ReactElement);

    // Header title and subtitle
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "organizations.projects.new.channel.channel_select_title"
    );
    expect(
      screen.getByText("organizations.projects.new.channel.channel_select_subtitle")
    ).toBeInTheDocument();

    // Options container with correct titles
    expect(screen.getByTestId("options")).toHaveTextContent(
      "organizations.projects.new.channel.link_and_email_surveys," +
        "organizations.projects.new.channel.in_product_surveys"
    );

    // Close button link rendered when projects >=1
    const closeLink = screen.getByRole("link");
    expect(closeLink).toHaveAttribute("href", "/");
  });

  test("does not render close button when no projects", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValue({ session: { user: { id: "user1" } } } as any);
    vi.mocked(getTranslate).mockResolvedValue(mockTranslate);
    vi.mocked(getUserProjects).mockResolvedValue([]);

    const element = await Page({ params });
    render(element as React.ReactElement);

    expect(screen.queryByRole("link")).toBeNull();
  });
});
