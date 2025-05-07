import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProjectLookSettingsLoading } from "./loading";

vi.mock("@/app/(app)/environments/[environmentId]/settings/components/SettingsCard", () => ({
  SettingsCard: ({ children, ...props }: any) => (
    <div data-testid="settings-card" {...props}>
      {children}
    </div>
  ),
}));
vi.mock("@/modules/projects/settings/components/project-config-navigation", () => ({
  ProjectConfigNavigation: (props: any) => <div data-testid="project-config-navigation" {...props} />,
}));
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }: any) => <div data-testid="page-content-wrapper">{children}</div>,
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ children, pageTitle }: any) => (
    <div data-testid="page-header">
      <div>{pageTitle}</div>
      {children}
    </div>
  ),
}));

// Badge, Button, Label, RadioGroup, RadioGroupItem, Switch are simple enough, no need to mock

describe("ProjectLookSettingsLoading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all tolgee strings and main UI elements", () => {
    render(<ProjectLookSettingsLoading />);
    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("project-config-navigation")).toBeInTheDocument();
    expect(screen.getAllByTestId("settings-card").length).toBe(4);
    expect(screen.getByText("common.project_configuration")).toBeInTheDocument();
    expect(screen.getByText("environments.project.look.enable_custom_styling")).toBeInTheDocument();
    expect(
      screen.getByText("environments.project.look.enable_custom_styling_description")
    ).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.form_styling")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.style_the_question_texts_descriptions_and_input_fields")
    ).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.card_styling")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.style_the_survey_card")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.background_styling")).toBeInTheDocument();
    expect(screen.getByText("common.link_surveys")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.change_the_background_to_a_color_image_or_animation")
    ).toBeInTheDocument();
    expect(screen.getAllByText("common.loading").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("common.preview")).toBeInTheDocument();
    expect(screen.getByText("common.restart")).toBeInTheDocument();
    expect(screen.getByText("environments.project.look.show_powered_by_formbricks")).toBeInTheDocument();
    expect(screen.getByText("common.bottom_right")).toBeInTheDocument();
    expect(screen.getByText("common.top_right")).toBeInTheDocument();
    expect(screen.getByText("common.top_left")).toBeInTheDocument();
    expect(screen.getByText("common.bottom_left")).toBeInTheDocument();
    expect(screen.getByText("common.centered_modal")).toBeInTheDocument();
  });
});
