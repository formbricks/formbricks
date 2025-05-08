import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Loading from "./loading";

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-content-wrapper">{children}</div>
  ),
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ pageTitle }: { pageTitle: string }) => <div data-testid="page-header">{pageTitle}</div>,
}));

describe("Loading Notifications Settings", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders loading state correctly", () => {
    render(<Loading />);

    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    const pageHeader = screen.getByTestId("page-header");
    expect(pageHeader).toBeInTheDocument();
    expect(pageHeader).toHaveTextContent("common.account_settings");

    // Check for Alerts LoadingCard
    expect(screen.getByText("environments.settings.notifications.email_alerts_surveys")).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.notifications.set_up_an_alert_to_get_an_email_on_new_responses")
    ).toBeInTheDocument();
    const alertsCard = screen
      .getByText("environments.settings.notifications.email_alerts_surveys")
      .closest("div[class*='rounded-xl']"); // Find parent card
    expect(alertsCard).toBeInTheDocument();

    // Check for Weekly Summary LoadingCard
    expect(
      screen.getByText("environments.settings.notifications.weekly_summary_projects")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.notifications.stay_up_to_date_with_a_Weekly_every_Monday")
    ).toBeInTheDocument();
    const weeklySummaryCard = screen
      .getByText("environments.settings.notifications.weekly_summary_projects")
      .closest("div[class*='rounded-xl']"); // Find parent card
    expect(weeklySummaryCard).toBeInTheDocument();
  });
});
