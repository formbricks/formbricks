import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Loading from "./loading";

// Mock constants
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false, // Enterprise page is typically for self-hosted
}));

// Mock server-side translation
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

// Mock child components
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-content-wrapper">{children}</div>
  ),
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ pageTitle, children }: { pageTitle: string; children: React.ReactNode }) => (
    <div data-testid="page-header">
      <h1>{pageTitle}</h1>
      {children}
    </div>
  ),
}));

vi.mock(
  "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar",
  () => ({
    OrganizationSettingsNavbar: ({ activeId, loading }: { activeId: string; loading?: boolean }) => (
      <div data-testid="org-settings-navbar">
        Active: {activeId}, Loading: {String(loading)}
      </div>
    ),
  })
);

describe("Enterprise Loading Page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders PageContentWrapper, PageHeader, and OrganizationSettingsNavbar", async () => {
    render(await Loading());

    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    const pageHeader = screen.getByTestId("page-header");
    expect(pageHeader).toBeInTheDocument();
    expect(pageHeader).toHaveTextContent("environments.settings.general.organization_settings");

    const navbar = screen.getByTestId("org-settings-navbar");
    expect(navbar).toBeInTheDocument();
    expect(navbar).toHaveTextContent("Active: enterprise");
    expect(navbar).toHaveTextContent("Loading: true");
  });

  test("renders placeholder divs", async () => {
    render(await Loading());
    const placeholders = screen.getAllByRole("generic", { hidden: true });
    const animatedPlaceholders = placeholders.filter((el) => el.classList.contains("animate-pulse"));
    expect(animatedPlaceholders.length).toBeGreaterThanOrEqual(2);
  });
});
