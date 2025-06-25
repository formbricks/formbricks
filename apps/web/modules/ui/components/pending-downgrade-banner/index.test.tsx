import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PendingDowngradeBanner } from "./index";

// Mock the useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string, params?: any) => {
      if (key === "common.pending_downgrade") return "Pending Downgrade";
      if (key === "common.we_were_unable_to_verify_your_license_because_the_license_server_is_unreachable")
        return "We were unable to verify your license because the license server is unreachable";
      if (key === "common.you_will_be_downgraded_to_the_community_edition_on_date")
        return `You will be downgraded to the community edition on ${params?.date}`;
      if (key === "common.you_are_downgraded_to_the_community_edition")
        return "You are downgraded to the community edition";
      if (key === "common.learn_more") return "Learn more";
      if (key === "common.close") return "Close";
      return key;
    },
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="mock-link">
      {children}
    </a>
  ),
}));

describe("PendingDowngradeBanner", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders banner when active and isPendingDowngrade are true", () => {
    const currentDate = new Date();
    const lastChecked = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000); // One day ago

    render(
      <PendingDowngradeBanner
        lastChecked={lastChecked}
        active={true}
        isPendingDowngrade={true}
        environmentId="env-123"
      />
    );

    expect(screen.getByText("Pending Downgrade")).toBeInTheDocument();
    // Check if learn more link is present
    const learnMoreLink = screen.getByText("Learn more");
    expect(learnMoreLink).toBeInTheDocument();
    expect(screen.getByTestId("mock-link")).toHaveAttribute(
      "href",
      "/environments/env-123/settings/enterprise"
    );
  });

  test("doesn't render when active is false", () => {
    const currentDate = new Date();
    const lastChecked = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000); // One day ago

    render(
      <PendingDowngradeBanner
        lastChecked={lastChecked}
        active={false}
        isPendingDowngrade={true}
        environmentId="env-123"
      />
    );

    expect(screen.queryByText("Pending Downgrade")).not.toBeInTheDocument();
  });

  test("doesn't render when isPendingDowngrade is false", () => {
    const currentDate = new Date();
    const lastChecked = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000); // One day ago

    render(
      <PendingDowngradeBanner
        lastChecked={lastChecked}
        active={true}
        isPendingDowngrade={false}
        environmentId="env-123"
      />
    );

    expect(screen.queryByText("Pending Downgrade")).not.toBeInTheDocument();
  });

  test("closes banner when close button is clicked", async () => {
    const user = userEvent.setup();
    const currentDate = new Date();
    const lastChecked = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000); // One day ago

    render(
      <PendingDowngradeBanner
        lastChecked={lastChecked}
        active={true}
        isPendingDowngrade={true}
        environmentId="env-123"
      />
    );

    expect(screen.getByText("Pending Downgrade")).toBeInTheDocument();

    // Find and click the close button
    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);

    // Banner should no longer be visible
    expect(screen.queryByText("Pending Downgrade")).not.toBeInTheDocument();
  });
});
