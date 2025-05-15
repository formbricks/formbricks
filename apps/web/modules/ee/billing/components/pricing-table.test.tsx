import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganizationBillingPeriod } from "@formbricks/types/organizations";
import { PricingTable } from "./pricing-table";

// Mock the env module
vi.mock("@/lib/env", () => ({
  env: {
    IS_FORMBRICKS_CLOUD: "0",
    NODE_ENV: "test",
  },
}));

// Mock the useRouter hook
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock the actions module
vi.mock("@/modules/ee/billing/actions", () => {
  const mockDate = new Date("2024-03-15T00:00:00.000Z");
  return {
    isSubscriptionCancelledAction: vi.fn(() => Promise.resolve({ data: { date: mockDate } })),
    manageSubscriptionAction: vi.fn(() => Promise.resolve({ data: null })),
    upgradePlanAction: vi.fn(() => Promise.resolve({ data: null })),
  };
});

// Mock the useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

describe("PricingTable", () => {
  afterEach(() => {
    cleanup();
  });

  test("should display a 'Cancelling' badge with the correct date if the subscription is being cancelled", async () => {
    const mockOrganization = {
      id: "org-123",
      name: "Test Organization",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        plan: "free",
        period: "yearly",
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

    const mockStripePriceLookupKeys = {
      STARTUP_MONTHLY: "startup_monthly",
      STARTUP_YEARLY: "startup_yearly",
      SCALE_MONTHLY: "scale_monthly",
      SCALE_YEARLY: "scale_yearly",
    };

    const mockProjectFeatureKeys = {
      FREE: "free",
      STARTUP: "startup",
      SCALE: "scale",
      ENTERPRISE: "enterprise",
    };

    render(
      <PricingTable
        organization={mockOrganization as any}
        environmentId="env-123"
        peopleCount={50}
        responseCount={75}
        projectCount={1}
        stripePriceLookupKeys={mockStripePriceLookupKeys}
        projectFeatureKeys={mockProjectFeatureKeys}
        hasBillingRights={true}
      />
    );

    const expectedDate = new Date("2024-03-15T00:00:00.000Z").toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    const cancellingBadge = await screen.findByText(`Cancelling: ${expectedDate}`);
    expect(cancellingBadge).toBeInTheDocument();
  });

  // [Tusk] FAILING TEST
  test("billing period toggle buttons have correct aria-pressed attributes", async () => {
    const MockPricingTable = () => {
      const [planPeriod, setPlanPeriod] = useState<TOrganizationBillingPeriod>("yearly");

      const mockOrganization = {
        id: "org-123",
        name: "Test Organization",
        createdAt: new Date(),
        updatedAt: new Date(),
        billing: {
          plan: "free",
          period: "yearly",
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

      const mockStripePriceLookupKeys = {
        STARTUP_MONTHLY: "startup_monthly",
        STARTUP_YEARLY: "startup_yearly",
        SCALE_MONTHLY: "scale_monthly",
        SCALE_YEARLY: "scale_yearly",
      };

      const mockProjectFeatureKeys = {
        FREE: "free",
        STARTUP: "startup",
        SCALE: "scale",
        ENTERPRISE: "enterprise",
      };

      const handleMonthlyToggle = (period: TOrganizationBillingPeriod) => {
        setPlanPeriod(period);
      };

      return (
        <PricingTable
          organization={mockOrganization as any}
          environmentId="env-123"
          peopleCount={50}
          responseCount={75}
          projectCount={1}
          stripePriceLookupKeys={mockStripePriceLookupKeys}
          projectFeatureKeys={mockProjectFeatureKeys}
          hasBillingRights={true}
        />
      );
    };

    render(<MockPricingTable />);

    const monthlyButton = screen.getByText("environments.settings.billing.monthly");
    const yearlyButton = screen.getByText("environments.settings.billing.annually");

    expect(yearlyButton).toHaveAttribute("aria-pressed", "true");
    expect(monthlyButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(monthlyButton);

    expect(yearlyButton).toHaveAttribute("aria-pressed", "false");
    expect(monthlyButton).toHaveAttribute("aria-pressed", "true");
  });
});
