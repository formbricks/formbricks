import { cleanup, render, screen } from "@testing-library/react";
import { TFnType } from "@tolgee/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { EmptySpaceFiller } from "./index";

// Mock the useTranslate hook
const mockTranslate: TFnType = (key) => key;
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: mockTranslate }),
}));

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: vi.fn(({ href, className, children }) => (
    <a href={href} className={className} data-testid="mock-link">
      {children}
    </a>
  )),
}));

describe("EmptySpaceFiller", () => {
  afterEach(() => {
    cleanup();
  });

  const mockEnvironmentNotSetup: TEnvironment = {
    id: "env-123",
    appSetupCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    type: "production",
    projectId: "proj-123",
  };

  const mockEnvironmentSetup: TEnvironment = {
    ...mockEnvironmentNotSetup,
    appSetupCompleted: true,
  };

  test("renders table type with app not setup", () => {
    render(<EmptySpaceFiller type="table" environment={mockEnvironmentNotSetup} />);

    expect(screen.getByText("environments.surveys.summary.install_widget")).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("environments.surveys.summary.go_to_setup_checklist"))
    ).toBeInTheDocument();

    const linkElement = screen.getByTestId("mock-link");
    expect(linkElement).toHaveAttribute(
      "href",
      `/environments/${mockEnvironmentNotSetup.id}/project/app-connection`
    );
  });

  test("renders table type with app setup and custom message", () => {
    const customMessage = "Custom empty message";
    render(<EmptySpaceFiller type="table" environment={mockEnvironmentSetup} emptyMessage={customMessage} />);

    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.summary.install_widget")).not.toBeInTheDocument();
  });

  test("renders table type with noWidgetRequired", () => {
    const customMessage = "Custom empty message";
    render(
      <EmptySpaceFiller
        type="table"
        environment={mockEnvironmentNotSetup}
        noWidgetRequired={true}
        emptyMessage={customMessage}
      />
    );

    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.summary.install_widget")).not.toBeInTheDocument();
  });

  test("renders response type with app not setup", () => {
    render(<EmptySpaceFiller type="response" environment={mockEnvironmentNotSetup} />);

    expect(screen.getByText("environments.surveys.summary.install_widget")).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("environments.surveys.summary.go_to_setup_checklist"))
    ).toBeInTheDocument();

    const linkElement = screen.getByTestId("mock-link");
    expect(linkElement).toHaveAttribute(
      "href",
      `/environments/${mockEnvironmentNotSetup.id}/project/app-connection`
    );
  });

  test("renders response type with app setup", () => {
    render(<EmptySpaceFiller type="response" environment={mockEnvironmentSetup} />);

    expect(screen.getByText("environments.surveys.summary.waiting_for_response")).toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.summary.install_widget")).not.toBeInTheDocument();
  });

  test("renders response type with custom message", () => {
    const customMessage = "Custom response message";
    render(
      <EmptySpaceFiller type="response" environment={mockEnvironmentSetup} emptyMessage={customMessage} />
    );

    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.summary.waiting_for_response")).not.toBeInTheDocument();
  });

  test("renders tag type with app not setup", () => {
    render(<EmptySpaceFiller type="tag" environment={mockEnvironmentNotSetup} />);

    expect(screen.getByText("environments.surveys.summary.install_widget")).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("environments.surveys.summary.go_to_setup_checklist"))
    ).toBeInTheDocument();

    const linkElement = screen.getByTestId("mock-link");
    expect(linkElement).toHaveAttribute(
      "href",
      `/environments/${mockEnvironmentNotSetup.id}/project/app-connection`
    );
  });

  test("renders tag type with app setup", () => {
    render(<EmptySpaceFiller type="tag" environment={mockEnvironmentSetup} />);

    expect(screen.getByText("environments.project.tags.empty_message")).toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.summary.install_widget")).not.toBeInTheDocument();
  });

  test("renders summary type", () => {
    render(<EmptySpaceFiller type="summary" environment={mockEnvironmentSetup} />);

    // Summary type renders a skeleton, so we should check if it's properly rendered
    const skeletonElements = document.querySelectorAll(".bg-slate-100");
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  test("renders default type (event, linkResponse) with app not setup", () => {
    render(<EmptySpaceFiller type="event" environment={mockEnvironmentNotSetup} />);

    expect(screen.getByText("environments.surveys.summary.install_widget")).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("environments.surveys.summary.go_to_setup_checklist"))
    ).toBeInTheDocument();

    const linkElement = screen.getByTestId("mock-link");
    expect(linkElement).toHaveAttribute(
      "href",
      `/environments/${mockEnvironmentNotSetup.id}/project/app-connection`
    );
  });

  test("renders default type with app setup", () => {
    render(<EmptySpaceFiller type="event" environment={mockEnvironmentSetup} />);

    expect(screen.getByText("environments.surveys.summary.waiting_for_response")).toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.summary.install_widget")).not.toBeInTheDocument();
  });

  test("renders default type with noWidgetRequired", () => {
    render(<EmptySpaceFiller type="event" environment={mockEnvironmentNotSetup} noWidgetRequired={true} />);

    expect(screen.getByText("environments.surveys.summary.waiting_for_response")).toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.summary.install_widget")).not.toBeInTheDocument();
  });
});
