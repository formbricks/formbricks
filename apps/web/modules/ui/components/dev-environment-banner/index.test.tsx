import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { DevEnvironmentBanner } from "./index";

// Mock the useTranslate hook from @tolgee/react
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

describe("DevEnvironmentBanner", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders banner when environment type is development", () => {
    const environment: TEnvironment = {
      id: "env-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      type: "development",
      projectId: "proj-123",
      appSetupCompleted: true,
    };

    render(<DevEnvironmentBanner environment={environment} />);

    const banner = screen.getByText("common.development_environment_banner");
    expect(banner).toBeInTheDocument();
    expect(banner.classList.contains("bg-orange-800")).toBeTruthy();
  });

  test("does not render banner when environment type is not development", () => {
    const environment: TEnvironment = {
      id: "env-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      type: "production",
      projectId: "proj-123",
      appSetupCompleted: true,
    };

    render(<DevEnvironmentBanner environment={environment} />);

    expect(screen.queryByText("common.development_environment_banner")).not.toBeInTheDocument();
  });
});
