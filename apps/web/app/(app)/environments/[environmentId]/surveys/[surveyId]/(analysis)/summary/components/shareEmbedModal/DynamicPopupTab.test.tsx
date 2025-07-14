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

// Mock DocumentationLinksSection
vi.mock("./documentation-links-section", () => ({
  DocumentationLinksSection: (props: { title: string; links: Array<{ href: string; title: string }> }) => (
    <div data-testid="documentation-links-section" data-title={props.title}>
      {props.links.map((link) => (
        <div key={link.title} data-testid="documentation-link" data-href={link.href} data-title={link.title}>
          {link.title}
        </div>
      ))}
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

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

describe("DynamicPopupTab", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    environmentId: "env-123",
    surveyId: "survey-123",
  };

  test("renders with correct container structure", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const container = screen.getByTestId("alert").parentElement;
    expect(container).toHaveClass("flex", "h-full", "flex-col", "justify-between", "space-y-4");
  });

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

    const link = screen.getByTestId("next-link");
    expect(link).toHaveAttribute("href", "/environments/env-123/surveys/survey-123/edit");
    expect(link).toHaveTextContent("environments.surveys.summary.dynamic_popup.alert_button");
  });

  test("renders DocumentationLinksSection with correct title", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const documentationSection = screen.getByTestId("documentation-links-section");
    expect(documentationSection).toBeInTheDocument();
    expect(documentationSection).toHaveAttribute(
      "data-title",
      "environments.surveys.summary.dynamic_popup.title"
    );
  });

  test("passes correct documentation links to DocumentationLinksSection", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const documentationLinks = screen.getAllByTestId("documentation-link");
    expect(documentationLinks).toHaveLength(3);

    // Check attribute-based targeting link
    const attributeLink = documentationLinks.find(
      (link) =>
        link.getAttribute("data-href") ===
        "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/advanced-targeting"
    );
    expect(attributeLink).toBeInTheDocument();
    expect(attributeLink).toHaveAttribute(
      "data-title",
      "environments.surveys.summary.dynamic_popup.attribute_based_targeting"
    );

    // Check code and no code triggers link
    const actionsLink = documentationLinks.find(
      (link) =>
        link.getAttribute("data-href") ===
        "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/actions"
    );
    expect(actionsLink).toBeInTheDocument();
    expect(actionsLink).toHaveAttribute(
      "data-title",
      "environments.surveys.summary.dynamic_popup.code_no_code_triggers"
    );

    // Check recontact options link
    const recontactLink = documentationLinks.find(
      (link) =>
        link.getAttribute("data-href") ===
        "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/recontact"
    );
    expect(recontactLink).toBeInTheDocument();
    expect(recontactLink).toHaveAttribute(
      "data-title",
      "environments.surveys.summary.dynamic_popup.recontact_options"
    );
  });

  test("renders documentation links with correct titles", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const documentationLinks = screen.getAllByTestId("documentation-link");

    const expectedTitles = [
      "environments.surveys.summary.dynamic_popup.attribute_based_targeting",
      "environments.surveys.summary.dynamic_popup.code_no_code_triggers",
      "environments.surveys.summary.dynamic_popup.recontact_options",
    ];

    expectedTitles.forEach((title) => {
      const link = documentationLinks.find((link) => link.getAttribute("data-title") === title);
      expect(link).toBeInTheDocument();
      expect(link).toHaveTextContent(title);
    });
  });

  test("renders documentation links with correct URLs", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    const documentationLinks = screen.getAllByTestId("documentation-link");

    const expectedUrls = [
      "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/advanced-targeting",
      "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/actions",
      "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/recontact",
    ];

    expectedUrls.forEach((url) => {
      const link = documentationLinks.find((link) => link.getAttribute("data-href") === url);
      expect(link).toBeInTheDocument();
    });
  });

  test("calls translation function for all text content", () => {
    render(<DynamicPopupTab {...defaultProps} />);

    // Check alert translations
    expect(screen.getByTestId("alert-title")).toHaveTextContent(
      "environments.surveys.summary.dynamic_popup.alert_title"
    );
    expect(screen.getByTestId("alert-description")).toHaveTextContent(
      "environments.surveys.summary.dynamic_popup.alert_description"
    );
    expect(screen.getByTestId("next-link")).toHaveTextContent(
      "environments.surveys.summary.dynamic_popup.alert_button"
    );

    // Check documentation section title
    expect(screen.getByTestId("documentation-links-section")).toHaveAttribute(
      "data-title",
      "environments.surveys.summary.dynamic_popup.title"
    );
  });

  test("renders with correct props when environmentId and surveyId change", () => {
    const newProps = {
      environmentId: "env-456",
      surveyId: "survey-456",
    };

    render(<DynamicPopupTab {...newProps} />);

    const link = screen.getByTestId("next-link");
    expect(link).toHaveAttribute("href", "/environments/env-456/surveys/survey-456/edit");
  });
});
