import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Loading from "./loading";

vi.mock(
  "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar",
  () => ({
    OrganizationSettingsNavbar: () => <div data-testid="org-navbar">OrgNavbar</div>,
  })
);
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }) => <div data-testid="content-wrapper">{children}</div>,
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ children, pageTitle }) => (
    <div data-testid="page-header">
      <span>{pageTitle}</span>
      {children}
    </div>
  ),
}));
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (k) => k }),
}));

describe("Loading (API Keys)", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders loading skeletons and tolgee strings", () => {
    render(<Loading isFormbricksCloud={true} />);
    expect(screen.getByTestId("content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("org-navbar")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.general.organization_settings")).toBeInTheDocument();
    expect(screen.getAllByText("common.loading").length).toBeGreaterThan(0);
    expect(screen.getByText("environments.project.api_keys.api_key")).toBeInTheDocument();
    expect(screen.getByText("common.label")).toBeInTheDocument();
    expect(screen.getByText("common.created_at")).toBeInTheDocument();
  });
});
