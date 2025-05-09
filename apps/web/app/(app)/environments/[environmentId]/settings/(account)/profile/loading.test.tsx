import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Loading from "./loading";

vi.mock(
  "@/app/(app)/environments/[environmentId]/settings/(account)/components/AccountSettingsNavbar",
  () => ({
    AccountSettingsNavbar: ({ activeId, loading }) => (
      <div data-testid="account-settings-navbar">
        AccountSettingsNavbar - active: {activeId}, loading: {loading?.toString()}
      </div>
    ),
  })
);

vi.mock("@/app/(app)/components/LoadingCard", () => ({
  LoadingCard: ({ title, description }) => (
    <div data-testid="loading-card">
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ pageTitle, children }) => (
    <div>
      <h1>{pageTitle}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }) => <div>{children}</div>,
}));

describe("Loading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders loading state correctly", () => {
    render(<Loading />);

    expect(screen.getByText("common.account_settings")).toBeInTheDocument();
    expect(screen.getByTestId("account-settings-navbar")).toHaveTextContent(
      "AccountSettingsNavbar - active: profile, loading: true"
    );

    const loadingCards = screen.getAllByTestId("loading-card");
    expect(loadingCards).toHaveLength(3);

    expect(loadingCards[0]).toHaveTextContent("environments.settings.profile.personal_information");
    expect(loadingCards[0]).toHaveTextContent("environments.settings.profile.update_personal_info");

    expect(loadingCards[1]).toHaveTextContent("common.avatar");
    expect(loadingCards[1]).toHaveTextContent("environments.settings.profile.organization_identification");

    expect(loadingCards[2]).toHaveTextContent("environments.settings.profile.delete_account");
    expect(loadingCards[2]).toHaveTextContent("environments.settings.profile.confirm_delete_account");
  });
});
