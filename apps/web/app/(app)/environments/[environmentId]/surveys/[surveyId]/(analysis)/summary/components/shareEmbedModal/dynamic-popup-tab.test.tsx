import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DynamicPopupTab } from "./dynamic-popup-tab";

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
  H3: (props: { children: React.ReactNode }) => <div data-testid="h3">{props.children}</div>,
  H4: (props: { children: React.ReactNode }) => <div data-testid="h4">{props.children}</div>,
  Small: (props: { children: React.ReactNode; color?: string; margin?: string }) => (
    <div data-testid="small" data-color={props.color} data-margin={props.margin}>
      {props.children}
    </div>
  ),
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

    const alerts = screen.getAllByTestId("alert");
    const infoAlert = alerts.find((alert) => alert.getAttribute("data-variant") === "info");
    expect(infoAlert).toBeInTheDocument();
    expect(infoAlert).toHaveAttribute("data-variant", "info");
    expect(infoAlert).toHaveAttribute("data-size", "default");
  });

  test("renders alert title with translation key", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const alertTitles = screen.getAllByTestId("alert-title");
    const infoAlertTitle = alertTitles[0]; // The first one is the info alert
    expect(infoAlertTitle).toBeInTheDocument();
    expect(infoAlertTitle).toHaveTextContent("environments.surveys.share.dynamic_popup.alert_title");
  });

  test("renders alert description with translation key", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const alertDescription = screen.getByTestId("alert-description");
    expect(alertDescription).toBeInTheDocument();
    expect(alertDescription).toHaveTextContent("environments.surveys.share.dynamic_popup.alert_description");
  });

  test("renders alert button with link to survey edit page", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const alertButtons = screen.getAllByTestId("alert-button");
    const infoAlertButton = alertButtons[0]; // The first one is the info alert
    expect(infoAlertButton).toBeInTheDocument();
    expect(infoAlertButton).toHaveAttribute("data-as-child", "true");

    const link = screen.getAllByTestId("next-link")[0];
    expect(link).toHaveAttribute("href", "/environments/env-123/surveys/survey-123/edit");
    expect(link).toHaveTextContent("environments.surveys.share.dynamic_popup.alert_button");
  });

  test("renders title with correct text", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const h3 = screen.getByTestId("h3");
    expect(h3).toBeInTheDocument();
    expect(h3).toHaveTextContent("environments.surveys.share.dynamic_popup.title");
  });

  test("renders attribute-based targeting documentation button", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const links = screen.getAllByRole("link");
    const attributeLink = links.find((link) => link.getAttribute("href")?.includes("advanced-targeting"));

    expect(attributeLink).toBeDefined();
    expect(attributeLink).toHaveAttribute(
      "href",
      "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/advanced-targeting"
    );
    expect(attributeLink).toHaveAttribute("target", "_blank");
  });

  test("renders code and no code triggers documentation button", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const links = screen.getAllByRole("link");
    const actionsLink = links.find((link) => link.getAttribute("href")?.includes("actions"));

    expect(actionsLink).toBeDefined();
    expect(actionsLink).toHaveAttribute(
      "href",
      "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/actions"
    );
    expect(actionsLink).toHaveAttribute("target", "_blank");
  });

  test("renders recontact options documentation button", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const links = screen.getAllByRole("link");
    const recontactLink = links.find((link) => link.getAttribute("href")?.includes("recontact"));

    expect(recontactLink).toBeDefined();
    expect(recontactLink).toHaveAttribute(
      "href",
      "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/recontact"
    );
    expect(recontactLink).toHaveAttribute("target", "_blank");
  });

  test("all documentation buttons have external link icons", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const links = screen.getAllByRole("link");
    const documentationLinks = links.filter(
      (link) =>
        link.getAttribute("href")?.includes("formbricks.com/docs") && link.getAttribute("target") === "_blank"
    );

    // There are 3 unique documentation URLs
    expect(documentationLinks).toHaveLength(3);

    documentationLinks.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
    });
  });

  test("documentation button links open in new tab", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const links = screen.getAllByRole("link");
    const documentationLinks = links.filter((link) =>
      link.getAttribute("href")?.includes("formbricks.com/docs")
    );

    documentationLinks.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
    });
  });
});
