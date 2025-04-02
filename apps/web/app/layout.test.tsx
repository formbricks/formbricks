import { getTolgee } from "@/tolgee/server";
import { cleanup, render, screen } from "@testing-library/react";
import { TolgeeInstance } from "@tolgee/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

// Mock dependencies for the layout

vi.mock("@formbricks/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  POSTHOG_API_KEY: "mock-posthog-api-key",
  POSTHOG_HOST: "mock-posthog-host",
  IS_POSTHOG_CONFIGURED: true,
  ENCRYPTION_KEY: "mock-encryption-key",
  WEBAPP_URL: "test-webapp-url",
  IS_PRODUCTION: false,
  SENTRY_DSN: "mock-sentry-dsn",
}));

vi.mock("@/tolgee/server", () => ({
  getTolgee: vi.fn(),
}));

vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: () => <div data-testid="speed-insights">SpeedInsights</div>,
}));

vi.mock("@/modules/ui/components/post-hog-client", () => ({
  PHProvider: ({ children, posthogEnabled }: { children: React.ReactNode; posthogEnabled: boolean }) => (
    <div data-testid="ph-provider">
      PHProvider: {posthogEnabled}
      {children}
    </div>
  ),
}));

vi.mock("@/tolgee/client", () => ({
  TolgeeNextProvider: ({
    children,
    language,
    staticData,
  }: {
    children: React.ReactNode;
    language: string;
    staticData: any;
  }) => (
    <div data-testid="tolgee-next-provider">
      TolgeeNextProvider: {language} {JSON.stringify(staticData)}
      {children}
    </div>
  ),
}));

vi.mock("@/app/sentry/SentryProvider", () => ({
  SentryProvider: ({ children, sentryDsn }: { children: React.ReactNode; sentryDsn?: string }) => (
    <div data-testid="sentry-provider">
      SentryProvider: {sentryDsn}
      {children}
    </div>
  ),
}));

describe("RootLayout", () => {
  beforeEach(() => {
    cleanup();
    process.env.VERCEL = "1";
  });

  it("renders the layout with the correct structure and providers", async () => {
    const fakeStaticData = { key: "value" };
    const fakeTolgee = {
      loadRequired: vi.fn().mockResolvedValue(fakeStaticData),
    };
    // Mock getTolgee to return our fake tolgee object
    vi.mocked(getTolgee).mockResolvedValue(fakeTolgee as unknown as TolgeeInstance);

    const children = <div data-testid="child">Child Content</div>;
    const element = await RootLayout({ children });
    render(element);

    // log env vercel
    console.log("vercel", process.env.VERCEL);

    expect(screen.getByTestId("speed-insights")).toBeInTheDocument();
    expect(screen.getByTestId("tolgee-next-provider")).toBeInTheDocument();
    expect(screen.getByTestId("sentry-provider")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
  });
});
