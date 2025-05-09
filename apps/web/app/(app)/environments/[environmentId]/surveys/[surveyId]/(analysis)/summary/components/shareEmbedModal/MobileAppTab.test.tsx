import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MobileAppTab } from "./MobileAppTab";

// Mock @tolgee/react
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key, // Return the key itself for easy assertion
  }),
}));

// Mock UI components
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  AlertTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-title">{children}</div>
  ),
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-description">{children}</div>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, asChild, ...props }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <div {...props}>{children}</div> : <button {...props}>{children}</button>,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, target, ...props }: any) => (
    <a href={href} target={target} {...props}>
      {children}
    </a>
  ),
}));

describe("MobileAppTab", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly with title, description, and learn more link", () => {
    render(<MobileAppTab />);

    // Check for Alert component
    expect(screen.getByTestId("alert")).toBeInTheDocument();

    // Check for AlertTitle with correct Tolgee key
    const alertTitle = screen.getByTestId("alert-title");
    expect(alertTitle).toBeInTheDocument();
    expect(alertTitle).toHaveTextContent("environments.surveys.summary.quickstart_mobile_apps");

    // Check for AlertDescription with correct Tolgee key
    const alertDescription = screen.getByTestId("alert-description");
    expect(alertDescription).toBeInTheDocument();
    expect(alertDescription).toHaveTextContent(
      "environments.surveys.summary.quickstart_mobile_apps_description"
    );

    // Check for the "Learn more" link
    const learnMoreLink = screen.getByRole("link", { name: "common.learn_more" });
    expect(learnMoreLink).toBeInTheDocument();
    expect(learnMoreLink).toHaveAttribute(
      "href",
      "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/framework-guides"
    );
    expect(learnMoreLink).toHaveAttribute("target", "_blank");
  });
});
