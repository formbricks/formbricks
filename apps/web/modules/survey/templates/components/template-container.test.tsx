import { Project } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TProjectConfigChannel, TProjectConfigIndustry } from "@formbricks/types/project";
import { TTemplateRole } from "@formbricks/types/templates";
import { TemplateContainerWithPreview } from "./template-container";

// Mock dependencies
vi.mock("@/app/lib/templates", () => ({
  customSurveyTemplate: vi.fn(() => ({
    preset: {
      questions: [{ id: "q1" }],
    },
  })),
}));

vi.mock("@/modules/survey/components/template-list", () => ({
  TemplateList: vi.fn(() => <div data-testid="template-list">Template List</div>),
}));

vi.mock("@/modules/survey/templates/components/menu-bar", () => ({
  MenuBar: vi.fn(() => <div data-testid="menu-bar">Menu Bar</div>),
}));

vi.mock("@/modules/ui/components/preview-survey", () => ({
  PreviewSurvey: vi.fn(() => <div data-testid="preview-survey">Preview Survey</div>),
}));

vi.mock("@/modules/ui/components/search-bar", () => ({
  SearchBar: vi.fn(({ placeholder, onChange, value }) => (
    <input
      data-testid="search-bar"
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      value={value}
    />
  )),
}));

vi.mock("../lib/minimal-survey", () => ({
  getMinimalSurvey: vi.fn(() => ({})),
}));

const mockProject = {
  id: "project1",
  name: "Test Project",
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: "org1",
  config: {
    channel: "website" as TProjectConfigChannel,
    industry: "technology" as TProjectConfigIndustry,
  },
} as Project;

const mockEnvironment = {
  id: "env1",
  appSetupCompleted: true,
};

const mockPrefilledFilters: (TProjectConfigChannel | TProjectConfigIndustry | TTemplateRole | null)[] = [];

describe("TemplateContainerWithPreview", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders MenuBar when isTemplatePage is true", () => {
    render(
      <TemplateContainerWithPreview
        project={mockProject}
        environment={mockEnvironment}
        userId="user1"
        prefilledFilters={mockPrefilledFilters}
        isTemplatePage={true}
      />
    );

    expect(screen.getByTestId("menu-bar")).toBeInTheDocument();
  });

  test("does not render MenuBar when isTemplatePage is false", () => {
    render(
      <TemplateContainerWithPreview
        project={mockProject}
        environment={mockEnvironment}
        userId="user1"
        prefilledFilters={mockPrefilledFilters}
        isTemplatePage={false}
      />
    );

    expect(screen.queryByTestId("menu-bar")).not.toBeInTheDocument();
  });

  test("displays correct title when isTemplatePage is true", () => {
    render(
      <TemplateContainerWithPreview
        project={mockProject}
        environment={mockEnvironment}
        userId="user1"
        prefilledFilters={mockPrefilledFilters}
        isTemplatePage={true}
      />
    );

    expect(screen.getByText("environments.surveys.templates.create_a_new_survey")).toBeInTheDocument();
  });

  test("displays correct title when isTemplatePage is false", () => {
    render(
      <TemplateContainerWithPreview
        project={mockProject}
        environment={mockEnvironment}
        userId="user1"
        prefilledFilters={mockPrefilledFilters}
        isTemplatePage={false}
      />
    );

    expect(screen.getByText("environments.surveys.all_set_time_to_create_first_survey")).toBeInTheDocument();
  });

  test("renders SearchBar with correct placeholder", () => {
    render(
      <TemplateContainerWithPreview
        project={mockProject}
        environment={mockEnvironment}
        userId="user1"
        prefilledFilters={mockPrefilledFilters}
        isTemplatePage={true}
      />
    );

    const searchBar = screen.getByTestId("search-bar");
    expect(searchBar).toBeInTheDocument();
    expect(searchBar).toHaveAttribute("placeholder", "common.search");
  });

  test("renders TemplateList component", () => {
    render(
      <TemplateContainerWithPreview
        project={mockProject}
        environment={mockEnvironment}
        userId="user1"
        prefilledFilters={mockPrefilledFilters}
        isTemplatePage={true}
      />
    );

    expect(screen.getByTestId("template-list")).toBeInTheDocument();
  });

  test("renders PreviewSurvey component in aside", () => {
    render(
      <TemplateContainerWithPreview
        project={mockProject}
        environment={mockEnvironment}
        userId="user1"
        prefilledFilters={mockPrefilledFilters}
        isTemplatePage={true}
      />
    );

    expect(screen.getByTestId("preview-survey")).toBeInTheDocument();
  });

  test("has correct container structure with h-full class", () => {
    render(
      <TemplateContainerWithPreview
        project={mockProject}
        environment={mockEnvironment}
        userId="user1"
        prefilledFilters={mockPrefilledFilters}
        isTemplatePage={true}
      />
    );

    const container = screen.getByTestId("menu-bar").parentElement;
    expect(container).toHaveClass("flex", "h-full", "flex-col");
  });
});
