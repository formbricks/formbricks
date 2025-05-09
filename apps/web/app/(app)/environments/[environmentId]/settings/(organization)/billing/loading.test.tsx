import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Loading from "./loading";

// Mock constants
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: true,
}));

// Mock server-side translation
vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
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

describe("Billing Loading Page", () => {
  beforeEach(async () => {
    const mockTranslate = vi.fn((key) => key);
    vi.mocked(await import("@/tolgee/server")).getTranslate.mockResolvedValue(mockTranslate);
  });

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
    expect(navbar).toHaveTextContent("Active: billing");
    expect(navbar).toHaveTextContent("Loading: true");
  });

  test("renders placeholder divs", async () => {
    render(await Loading());
    // Check for the presence of divs with animate-pulse, assuming they are the placeholders
    const placeholders = screen.getAllByRole("generic", { hidden: true }); // Using a generic role as divs don't have implicit roles
    const animatedPlaceholders = placeholders.filter((el) => el.classList.contains("animate-pulse"));
    expect(animatedPlaceholders.length).toBeGreaterThanOrEqual(2); // Expecting at least two placeholder divs
  });
});
