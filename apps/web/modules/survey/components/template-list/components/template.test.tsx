import { Project } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TTemplate, TTemplateFilter } from "@formbricks/types/templates";
import { replacePresetPlaceholders } from "../lib/utils";
import { Template } from "./template";

vi.mock("../lib/utils", () => ({
  replacePresetPlaceholders: vi.fn((template) => template),
}));

vi.mock("./template-tags", () => ({
  TemplateTags: () => <div data-testid="template-tags" />,
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

describe("Template Component", () => {
  afterEach(() => {
    cleanup();
  });

  const mockTemplate: TTemplate = {
    name: "Test Template",
    description: "Test Description",
    preset: {} as any,
  };

  const mockProject = { id: "project-id", name: "Test Project" } as Project;
  const mockSelectedFilter: TTemplateFilter[] = [];

  const defaultProps = {
    template: mockTemplate,
    activeTemplate: null,
    setActiveTemplate: vi.fn(),
    onTemplateClick: vi.fn(),
    project: mockProject,
    createSurvey: vi.fn(),
    loading: false,
    selectedFilter: mockSelectedFilter,
  };

  test("renders template correctly", () => {
    render(<Template {...defaultProps} />);

    expect(screen.getByText("Test Template")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByTestId("template-tags")).toBeInTheDocument();
  });

  test("calls createSurvey when noPreview is true and template is clicked", async () => {
    const user = userEvent.setup();

    render(<Template {...defaultProps} noPreview={true} />);

    await user.click(screen.getByText("Test Template").closest("div")!);

    expect(replacePresetPlaceholders).toHaveBeenCalledWith(mockTemplate, mockProject);
    expect(defaultProps.createSurvey).toHaveBeenCalledTimes(1);
    expect(defaultProps.onTemplateClick).not.toHaveBeenCalled();
    expect(defaultProps.setActiveTemplate).not.toHaveBeenCalled();
  });

  test("calls onTemplateClick and setActiveTemplate when noPreview is false", async () => {
    const user = userEvent.setup();

    render(<Template {...defaultProps} />);

    await user.click(screen.getByText("Test Template").closest("div")!);

    expect(replacePresetPlaceholders).toHaveBeenCalledWith(mockTemplate, mockProject);
    expect(defaultProps.onTemplateClick).toHaveBeenCalledTimes(1);
    expect(defaultProps.setActiveTemplate).toHaveBeenCalledTimes(1);
  });

  test("renders use template button when template is active", () => {
    render(<Template {...defaultProps} activeTemplate={mockTemplate} />);

    expect(screen.getByText("environments.surveys.templates.use_this_template")).toBeInTheDocument();
  });

  test("clicking use template button calls createSurvey", async () => {
    const user = userEvent.setup();

    render(<Template {...defaultProps} activeTemplate={mockTemplate} />);

    await user.click(screen.getByText("environments.surveys.templates.use_this_template"));

    expect(defaultProps.createSurvey).toHaveBeenCalledWith(mockTemplate);
  });

  test("applies correct styling when template is active", () => {
    render(<Template {...defaultProps} activeTemplate={mockTemplate} />);

    const templateElement = screen.getByText("Test Template").closest("div");
    expect(templateElement).toHaveClass("ring-2");
    expect(templateElement).toHaveClass("ring-slate-400");
  });
});
