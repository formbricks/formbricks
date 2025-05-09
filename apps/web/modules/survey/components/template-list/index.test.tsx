import { templates } from "@/app/lib/templates";
import { Project } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TTemplate } from "@formbricks/types/templates";
import { createSurveyAction } from "./actions";
import { TemplateList } from "./index";

vi.mock("@/app/lib/templates", () => ({
  templates: vi.fn(),
}));

vi.mock("./actions", () => ({
  createSurveyAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock("./components/start-from-scratch-template", () => ({
  StartFromScratchTemplate: vi.fn(() => <div data-testid="mock-start-from-scratch">Start from scratch</div>),
}));

vi.mock("./components/template", () => ({
  Template: vi.fn(
    ({ template, activeTemplate, setActiveTemplate, createSurvey, onTemplateClick, noPreview }) => (
      <div // NOSONAR
        data-testid={`mock-template-${template.name}`}
        onClick={() => noPreview && onTemplateClick && onTemplateClick(template)} //NOSONAR
      >
        {template.name}
        {activeTemplate?.name === template.name && (
          <button onClick={() => createSurvey(template)} data-testid="create-survey-button">
            Create Survey
          </button>
        )}
        <button onClick={() => !noPreview && setActiveTemplate(template)}>Select</button>
      </div>
    )
  ),
}));

vi.mock("./components/template-filters", () => ({
  TemplateFilters: vi.fn(() => <div data-testid="template-filters">Filters</div>),
}));

describe("TemplateList", () => {
  const mockRouter = {
    push: vi.fn(),
  };

  const mockTemplates: TTemplate[] = [
    {
      name: "Template 1",
      description: "Description 1",
      preset: { name: "Survey 1", questions: [] } as any,
      channels: ["website"],
      industries: ["saas"],
      role: "productManager",
    },
    {
      name: "Template 2",
      description: "Description 2",
      preset: { name: "Survey 2", questions: [] } as any,
      channels: ["link"],
      industries: ["eCommerce"],
      role: "productManager",
    },
  ];

  const mockProject = {
    id: "project-id",
    name: "Project Name",
    createdAt: new Date(),
    updatedAt: new Date(),
    config: {
      channel: "website",
    } as any,
  } as unknown as Project;

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue(mockRouter as any);
    vi.mocked(templates).mockReturnValue(mockTemplates);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly with default props", () => {
    render(
      <TemplateList
        userId="user-id"
        environmentId="env-id"
        project={mockProject}
        prefilledFilters={[null, null, null]}
      />
    );

    expect(screen.getByText("Start from scratch")).toBeInTheDocument();
  });

  test("renders filters when showFilters is true", () => {
    render(
      <TemplateList
        userId="user-id"
        environmentId="env-id"
        project={mockProject}
        prefilledFilters={[null, null, null]}
        showFilters={true}
      />
    );

    expect(screen.queryByTestId("template-filters")).toBeInTheDocument();
  });

  test("doesn't render filters when showFilters is false", () => {
    render(
      <TemplateList
        userId="user-id"
        environmentId="env-id"
        project={mockProject}
        prefilledFilters={[null, null, null]}
        showFilters={false}
      />
    );

    expect(screen.queryByTestId("template-filters")).not.toBeInTheDocument();
  });

  test("filters templates based on search string", () => {
    vi.mocked(templates).mockReturnValue(mockTemplates);

    render(
      <TemplateList
        userId="user-id"
        environmentId="env-id"
        project={mockProject}
        prefilledFilters={[null, null, null]}
        templateSearch="Template 1"
      />
    );

    expect(screen.queryByText("Template 2")).not.toBeInTheDocument();
  });

  test("calls onTemplateClick when a template is clicked with noPreview", async () => {
    const onTemplateClickMock = vi.fn();
    const user = userEvent.setup();

    render(
      <TemplateList
        userId="user-id"
        environmentId="env-id"
        project={mockProject}
        prefilledFilters={[null, null, null]}
        onTemplateClick={onTemplateClickMock}
        noPreview={true}
      />
    );

    const templateElement = screen.getByText("Template 1");
    await user.click(templateElement);

    expect(onTemplateClickMock).toHaveBeenCalledWith(mockTemplates[0]);
  });

  test("creates a survey successfully", async () => {
    vi.mocked(createSurveyAction).mockResolvedValue({
      data: { id: "new-survey-id" } as any,
    });

    const user = userEvent.setup();

    render(
      <TemplateList
        userId="user-id"
        environmentId="env-id"
        project={mockProject}
        prefilledFilters={[null, null, null]}
      />
    );

    // First select the template
    const selectButton = screen.getAllByText("Select")[0];
    await user.click(selectButton);

    // Then click create survey button
    const createButton = screen.getByTestId("create-survey-button");
    await user.click(createButton);

    expect(createSurveyAction).toHaveBeenCalledWith({
      environmentId: "env-id",
      surveyBody: {
        ...mockTemplates[0].preset,
        type: "app",
        createdBy: "user-id",
      },
    });

    expect(mockRouter.push).toHaveBeenCalledWith("/environments/env-id/surveys/new-survey-id/edit");
  });

  test("shows error when survey creation fails", async () => {
    vi.mocked(createSurveyAction).mockResolvedValue({} as any);

    const user = userEvent.setup();

    render(
      <TemplateList
        userId="user-id"
        environmentId="env-id"
        project={mockProject}
        prefilledFilters={[null, null, null]}
      />
    );

    // First select the template
    const selectButton = screen.getAllByText("Select")[0];
    await user.click(selectButton);

    // Then click create survey button
    const createButton = screen.getByTestId("create-survey-button");
    await user.click(createButton);

    expect(createSurveyAction).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  test("handles different project channel configurations", () => {
    const mobileProject = {
      ...mockProject,
      config: {
        channel: "mobile",
      },
    };

    const { rerender } = render(
      <TemplateList
        userId="user-id"
        environmentId="env-id"
        project={mobileProject as Project}
        prefilledFilters={[null, null, null]}
      />
    );

    // Test with no channel config
    const noChannelProject = {
      ...mockProject,
      config: {},
    };

    rerender(
      <TemplateList
        userId="user-id"
        environmentId="env-id"
        project={noChannelProject as Project}
        prefilledFilters={[null, null, null]}
      />
    );

    expect(screen.getByText("Template 1")).toBeInTheDocument();
  });

  test("development mode shows templates correctly", () => {
    vi.stubEnv("NODE_ENV", "development");

    render(
      <TemplateList
        userId="user-id"
        environmentId="env-id"
        project={mockProject}
        prefilledFilters={[null, null, null]}
      />
    );

    expect(screen.getByText("Template 1")).toBeInTheDocument();
    expect(screen.getByText("Template 2")).toBeInTheDocument();

    vi.unstubAllEnvs();
  });
});
