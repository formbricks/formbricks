import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DynamicPopupTab } from "./DynamicPopupTab";

// Mock components
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: (props: { variant?: string; size?: string; children: React.ReactNode }) => (
    <div data-testid="alert" data-variant={props.variant} data-size={props.size}>
      {props.children}
    </div>
  ),
  AlertButton: (props: { asChild?: boolean; children: React.ReactNode }) => (
    <div data-testid="alert-button" data-as-child={props.asChild}>
      {props.children}
    </div>
  ),
  AlertDescription: (props: { children: React.ReactNode }) => (
    <div data-testid="alert-description">{props.children}</div>
  ),
  AlertTitle: (props: { children: React.ReactNode }) => <div data-testid="alert-title">{props.children}</div>,
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: (props: { variant?: string; asChild?: boolean; children: React.ReactNode }) => (
    <div data-testid="button" data-variant={props.variant} data-as-child={props.asChild}>
      {props.children}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/typography", () => ({
  H4: (props: { children: React.ReactNode }) => <div data-testid="h4">{props.children}</div>,
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("lucide-react", () => ({
  ExternalLinkIcon: (props: { className?: string }) => (
    <div data-testid="external-link-icon" className={props.className}>
      ExternalLinkIcon
    </div>
  ),
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: (props: { href: string; target?: string; className?: string; children: React.ReactNode }) => (
    <a href={props.href} target={props.target} className={props.className} data-testid="next-link">
      {props.children}
    </a>
  ),
}));

describe("DynamicPopupTab", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    environmentId: "env-123",
    surveyId: "survey-123",
  };

  test("renders alert with correct props", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const alert = screen.getByTestId("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute("data-variant", "info");
    expect(alert).toHaveAttribute("data-size", "default");
  });

  test("renders alert title with translation key", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const alertTitle = screen.getByTestId("alert-title");
    expect(alertTitle).toBeInTheDocument();
    expect(alertTitle).toHaveTextContent("environments.surveys.summary.dynamic_popup.alert_title");
  });

  test("renders alert description with translation key", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const alertDescription = screen.getByTestId("alert-description");
    expect(alertDescription).toBeInTheDocument();
    expect(alertDescription).toHaveTextContent(
      "environments.surveys.summary.dynamic_popup.alert_description"
    );
  });

  test("renders alert button with link to survey edit page", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const alertButton = screen.getByTestId("alert-button");
    expect(alertButton).toBeInTheDocument();
    expect(alertButton).toHaveAttribute("data-as-child", "true");

    const link = screen.getAllByTestId("next-link")[0];
    expect(link).toHaveAttribute("href", "/environments/env-123/surveys/survey-123/edit");
    expect(link).toHaveTextContent("environments.surveys.summary.dynamic_popup.alert_button");
  });

  test("renders title with correct text", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const h4 = screen.getByTestId("h4");
    expect(h4).toBeInTheDocument();
    expect(h4).toHaveTextContent("environments.surveys.summary.dynamic_popup.title");
  });

  test("renders attribute-based targeting documentation button", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const links = screen.getAllByTestId("next-link");
    const attributeLink = links.find((link) => link.getAttribute("href")?.includes("advanced-targeting"));

    expect(attributeLink).toBeInTheDocument();
    expect(attributeLink).toHaveAttribute(
      "href",
      "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/advanced-targeting"
    );
    expect(attributeLink).toHaveAttribute("target", "_blank");
  });

  test("renders code and no code triggers documentation button", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const links = screen.getAllByTestId("next-link");
    const actionsLink = links.find((link) => link.getAttribute("href")?.includes("actions"));

    expect(actionsLink).toBeInTheDocument();
    expect(actionsLink).toHaveAttribute(
      "href",
      "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/actions"
    );
    expect(actionsLink).toHaveAttribute("target", "_blank");
  });

  test("renders recontact options documentation button", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const links = screen.getAllByTestId("next-link");
    const recontactLink = links.find((link) => link.getAttribute("href")?.includes("recontact"));

    expect(recontactLink).toBeInTheDocument();
    expect(recontactLink).toHaveAttribute(
      "href",
      "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/recontact"
    );
    expect(recontactLink).toHaveAttribute("target", "_blank");
  });

  test("all documentation buttons have external link icons", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const externalLinkIcons = screen.getAllByTestId("external-link-icon");
    expect(externalLinkIcons).toHaveLength(3);

    externalLinkIcons.forEach((icon) => {
      expect(icon).toHaveClass("h-4 w-4 flex-shrink-0");
    });
  });

  test("documentation button links open in new tab", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const documentationLinks = screen.getAllByTestId("next-link").slice(1, 4); // Skip the alert button link

    documentationLinks.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
    });
  });
});
