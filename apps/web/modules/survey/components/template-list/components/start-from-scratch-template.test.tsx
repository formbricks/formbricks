import { customSurveyTemplate } from "@/app/lib/templates";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TTemplate } from "@formbricks/types/templates";
import { replacePresetPlaceholders } from "../lib/utils";
import { StartFromScratchTemplate } from "./start-from-scratch-template";

vi.mock("@/app/lib/templates", () => ({
  customSurveyTemplate: vi.fn(),
}));

vi.mock("../lib/utils", () => ({
  replacePresetPlaceholders: vi.fn(),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/cn", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

describe("StartFromScratchTemplate", () => {
  afterEach(() => {
    cleanup();
  });

  const mockTemplate = {
    name: "Custom Survey",
    description: "Create a survey from scratch",
    icon: "PlusCircleIcon",
  } as unknown as TTemplate;

  const mockProject = {
    id: "project-1",
    name: "Test Project",
  } as any;

  test("renders with correct content", () => {
    vi.mocked(customSurveyTemplate).mockReturnValue(mockTemplate);

    const setActiveTemplateMock = vi.fn();
    const onTemplateClickMock = vi.fn();
    const createSurveyMock = vi.fn();

    render(
      <StartFromScratchTemplate
        activeTemplate={null}
        setActiveTemplate={setActiveTemplateMock}
        onTemplateClick={onTemplateClickMock}
        project={mockProject}
        createSurvey={createSurveyMock}
        loading={false}
      />
    );

    expect(screen.getByText(mockTemplate.name)).toBeInTheDocument();
    expect(screen.getByText(mockTemplate.description)).toBeInTheDocument();
  });

  test("handles click correctly without preview", async () => {
    vi.mocked(customSurveyTemplate).mockReturnValue(mockTemplate);
    const user = userEvent.setup();

    const setActiveTemplateMock = vi.fn();
    const onTemplateClickMock = vi.fn();
    const createSurveyMock = vi.fn();

    render(
      <StartFromScratchTemplate
        activeTemplate={null}
        setActiveTemplate={setActiveTemplateMock}
        onTemplateClick={onTemplateClickMock}
        project={mockProject}
        createSurvey={createSurveyMock}
        loading={false}
        noPreview={true}
      />
    );

    const cardButton = screen.getByRole("button", {
      name: `${mockTemplate.name} ${mockTemplate.description}`,
    });
    await user.click(cardButton);

    expect(createSurveyMock).toHaveBeenCalledWith(mockTemplate);
    expect(onTemplateClickMock).not.toHaveBeenCalled();
    expect(setActiveTemplateMock).not.toHaveBeenCalled();
  });

  test("handles click correctly with preview", async () => {
    vi.mocked(customSurveyTemplate).mockReturnValue(mockTemplate);
    const replacedTemplate = { ...mockTemplate, name: "Replaced Template" };
    vi.mocked(replacePresetPlaceholders).mockReturnValue(replacedTemplate);

    const user = userEvent.setup();
    const setActiveTemplateMock = vi.fn();
    const onTemplateClickMock = vi.fn();
    const createSurveyMock = vi.fn();

    render(
      <StartFromScratchTemplate
        activeTemplate={null}
        setActiveTemplate={setActiveTemplateMock}
        onTemplateClick={onTemplateClickMock}
        project={mockProject}
        createSurvey={createSurveyMock}
        loading={false}
      />
    );

    const cardButton = screen.getByRole("button", {
      name: `${mockTemplate.name} ${mockTemplate.description}`,
    });
    await user.click(cardButton);

    expect(replacePresetPlaceholders).toHaveBeenCalledWith(mockTemplate, mockProject);
    expect(onTemplateClickMock).toHaveBeenCalledWith(replacedTemplate);
    expect(setActiveTemplateMock).toHaveBeenCalledWith(replacedTemplate);
  });

  test("shows create button when template is active", () => {
    vi.mocked(customSurveyTemplate).mockReturnValue(mockTemplate);

    const setActiveTemplateMock = vi.fn();
    const onTemplateClickMock = vi.fn();
    const createSurveyMock = vi.fn();

    render(
      <StartFromScratchTemplate
        activeTemplate={mockTemplate}
        setActiveTemplate={setActiveTemplateMock}
        onTemplateClick={onTemplateClickMock}
        project={mockProject}
        createSurvey={createSurveyMock}
        loading={false}
      />
    );

    expect(screen.getByText("common.create_survey")).toBeInTheDocument();
  });

  test("create button calls createSurvey with active template", async () => {
    vi.mocked(customSurveyTemplate).mockReturnValue(mockTemplate);
    const user = userEvent.setup();

    const setActiveTemplateMock = vi.fn();
    const onTemplateClickMock = vi.fn();
    const createSurveyMock = vi.fn();

    render(
      <StartFromScratchTemplate
        activeTemplate={mockTemplate}
        setActiveTemplate={setActiveTemplateMock}
        onTemplateClick={onTemplateClickMock}
        project={mockProject}
        createSurvey={createSurveyMock}
        loading={false}
      />
    );

    const createButton = screen.getByText("common.create_survey");
    await user.click(createButton);

    expect(createSurveyMock).toHaveBeenCalledWith(mockTemplate);
  });

  test("button is disabled when loading is true", () => {
    vi.mocked(customSurveyTemplate).mockReturnValue(mockTemplate);

    const setActiveTemplateMock = vi.fn();
    const onTemplateClickMock = vi.fn();
    const createSurveyMock = vi.fn();

    render(
      <StartFromScratchTemplate
        activeTemplate={mockTemplate}
        setActiveTemplate={setActiveTemplateMock}
        onTemplateClick={onTemplateClickMock}
        project={mockProject}
        createSurvey={createSurveyMock}
        loading={true}
      />
    );

    const createButton = screen.getByText("common.create_survey").closest("button");

    // Check for the visual indicators that button is disabled
    expect(createButton).toBeInTheDocument();
    expect(createButton?.className).toContain("opacity-50");
    expect(createButton?.className).toContain("cursor-not-allowed");
  });
});
