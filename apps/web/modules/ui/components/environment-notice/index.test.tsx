/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
// Import the component after mocking
import { EnvironmentNotice } from "./index";

// Mock the imports used by the component
vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "https://app.example.com",
}));

vi.mock("@/lib/environment/service", () => ({
  getEnvironment: vi.fn((envId) => {
    if (envId === "env-production-123") {
      return Promise.resolve({
        id: "env-production-123",
        type: "production",
        projectId: "proj-123",
      });
    } else {
      return Promise.resolve({
        id: "env-development-456",
        type: "development",
        projectId: "proj-123",
      });
    }
  }),
  getEnvironments: vi.fn(() => {
    return Promise.resolve([
      {
        id: "env-production-123",
        type: "production",
        projectId: "proj-123",
      },
      {
        id: "env-development-456",
        type: "development",
        projectId: "proj-123",
      },
    ]);
  }),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(() => (key: string, params?: Record<string, string>) => {
    if (key === "common.environment_notice") {
      return `You are in the ${params?.environment} environment`;
    }
    if (key === "common.switch_to") {
      return `Switch to ${params?.environment}`;
    }
    return key;
  }),
}));

// Mock modules/ui/components/alert
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: vi.fn(({ children, ...props }) => <div {...props}>{children}</div>),
  AlertTitle: vi.fn(({ children, ...props }) => <h5 {...props}>{children}</h5>),
  AlertButton: vi.fn(({ children, ...props }) => <div {...props}>{children}</div>),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, className }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("EnvironmentNotice", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders production environment notice correctly", async () => {
    const component = await EnvironmentNotice({
      environmentId: "env-production-123",
      subPageUrl: "/surveys",
    });
    render(component);

    expect(screen.getByText("You are in the production environment")).toBeInTheDocument();

    // Look for an anchor tag with the right href
    const switchLink = screen.getByRole("link", {
      name: /switch to development/i,
    });

    expect(switchLink).toHaveAttribute(
      "href",
      "https://app.example.com/environments/env-development-456/surveys"
    );
  });

  test("renders development environment notice correctly", async () => {
    const component = await EnvironmentNotice({
      environmentId: "env-development-456",
      subPageUrl: "/surveys",
    });
    render(component);

    expect(screen.getByText("You are in the development environment")).toBeInTheDocument();

    // Look for an anchor tag with the right href
    const switchLink = screen.getByRole("link", {
      name: /switch to production/i,
    });

    expect(switchLink).toHaveAttribute(
      "href",
      "https://app.example.com/environments/env-production-123/surveys"
    );
  });
});
