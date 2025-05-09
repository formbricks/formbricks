import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { LimitsReachedBanner } from "./index";

// Mock the next/link component
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="mock-link">
      {children}
    </a>
  ),
}));

describe("LimitsReachedBanner", () => {
  afterEach(() => {
    cleanup();
  });

  const mockOrganization: TOrganization = {
    id: "org-123",
    name: "Test Organization",
    createdAt: new Date(),
    updatedAt: new Date(),
    billing: {
      plan: "free",
      period: "monthly",
      periodStart: new Date(),
      stripeCustomerId: null,
      limits: {
        monthly: {
          responses: 100,
          miu: 100,
        },
        projects: 1,
      },
    },
    isAIEnabled: false,
  };

  const defaultProps = {
    organization: mockOrganization,
    environmentId: "env-123",
    peopleCount: 0,
    responseCount: 0,
  };

  test("does not render when no limits are reached", () => {
    const { container } = render(<LimitsReachedBanner {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders when people limit is reached", () => {
    const peopleCount = 100;
    render(<LimitsReachedBanner {...defaultProps} peopleCount={peopleCount} />);

    expect(screen.getByText("common.limits_reached")).toBeInTheDocument();

    const learnMoreLink = screen.getByTestId("mock-link");
    expect(learnMoreLink).toHaveAttribute("href", "/environments/env-123/settings/billing");
    expect(learnMoreLink.textContent).toBe("common.learn_more");
  });

  test("renders when response limit is reached", () => {
    const responseCount = 100;
    render(<LimitsReachedBanner {...defaultProps} responseCount={responseCount} />);

    expect(screen.getByText("common.limits_reached")).toBeInTheDocument();
  });

  test("renders when both limits are reached", () => {
    const peopleCount = 100;
    const responseCount = 100;
    render(<LimitsReachedBanner {...defaultProps} peopleCount={peopleCount} responseCount={responseCount} />);

    expect(screen.getByText("common.limits_reached")).toBeInTheDocument();
  });

  test("closes the banner when the close button is clicked", async () => {
    const user = userEvent.setup();
    render(<LimitsReachedBanner {...defaultProps} peopleCount={100} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    expect(closeButton).toBeInTheDocument();

    await user.click(closeButton);

    expect(screen.queryByText("common.limits_reached")).not.toBeInTheDocument();
  });

  test("does not render when limits are undefined", () => {
    const orgWithoutLimits: TOrganization = {
      ...mockOrganization,
      billing: {
        ...mockOrganization.billing,
        limits: {
          monthly: {
            responses: null,
            miu: null,
          },
          projects: 1,
        },
      },
    };

    const { container } = render(
      <LimitsReachedBanner
        {...defaultProps}
        organization={orgWithoutLimits}
        peopleCount={100}
        responseCount={100}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
