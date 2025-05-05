import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SurveyEditorTabs } from "./survey-editor-tabs";

describe("SurveyEditorTabs", () => {
  afterEach(() => {
    cleanup();
  });

  test("should exclude the settings tab when isCxMode is true", () => {
    render(
      <SurveyEditorTabs
        activeId="questions"
        setActiveId={vi.fn()}
        isStylingTabVisible={true}
        isCxMode={true}
        isSurveyFollowUpsAllowed={true}
      />
    );

    expect(screen.getByText("common.questions")).toBeInTheDocument();
    expect(screen.getByText("common.styling")).toBeInTheDocument();
    expect(screen.queryByText("common.settings")).toBeNull();
    expect(screen.getByText("environments.surveys.edit.follow_ups")).toBeInTheDocument();
  });

  test("should mark the follow-ups tab as a pro feature when isSurveyFollowUpsAllowed is false", () => {
    render(
      <SurveyEditorTabs
        activeId="questions"
        setActiveId={vi.fn()}
        isStylingTabVisible={true}
        isCxMode={false}
        isSurveyFollowUpsAllowed={false}
      />
    );

    const followUpsTab = screen.getByText("environments.surveys.edit.follow_ups");
    expect(followUpsTab.closest("button")).toHaveTextContent("PRO");
  });

  test("should render all tabs including the styling tab when isStylingTabVisible is true", () => {
    render(
      <SurveyEditorTabs
        activeId="questions"
        setActiveId={vi.fn()}
        isStylingTabVisible={true}
        isCxMode={false}
        isSurveyFollowUpsAllowed={true}
      />
    );

    expect(screen.getByText("common.questions")).toBeInTheDocument();
    expect(screen.getByText("common.styling")).toBeInTheDocument();
    expect(screen.getByText("common.settings")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.follow_ups")).toBeInTheDocument();
  });

  test("should update the active tab ID when a tab is clicked", async () => {
    const setActiveId = vi.fn();
    render(
      <SurveyEditorTabs
        activeId="questions"
        setActiveId={setActiveId}
        isStylingTabVisible={true}
        isCxMode={false}
        isSurveyFollowUpsAllowed={true}
      />
    );

    const stylingTab = screen.getByText("common.styling");
    await userEvent.click(stylingTab);

    expect(setActiveId).toHaveBeenCalledWith("styling");
  });

  test("should handle activeId set to styling when isStylingTabVisible is false", () => {
    render(
      <SurveyEditorTabs
        activeId="styling"
        setActiveId={vi.fn()}
        isStylingTabVisible={false}
        isCxMode={false}
        isSurveyFollowUpsAllowed={true}
      />
    );

    expect(screen.queryByText("common.styling")).toBeNull();

    const questionsTab = screen.getByText("common.questions");
    expect(questionsTab).toBeInTheDocument();
  });

  test("should handle activeId set to settings when isCxMode is true", () => {
    render(
      <SurveyEditorTabs
        activeId="settings"
        setActiveId={vi.fn()}
        isStylingTabVisible={true}
        isCxMode={true}
        isSurveyFollowUpsAllowed={true}
      />
    );

    expect(screen.queryByText("common.settings")).toBeNull();

    const questionsTab = screen.getByText("common.questions");
    expect(questionsTab).toBeInTheDocument();
  });

  test("should render only the questions and followUps tabs when isStylingTabVisible is false, isCxMode is true and isSurveyFollowUpsAllowed is false", () => {
    render(
      <SurveyEditorTabs
        activeId="questions"
        setActiveId={vi.fn()}
        isStylingTabVisible={false}
        isCxMode={true}
        isSurveyFollowUpsAllowed={false}
      />
    );

    expect(screen.getByText("common.questions")).toBeInTheDocument();
    expect(screen.queryByText("common.styling")).toBeNull();
    expect(screen.queryByText("common.settings")).toBeNull();
    expect(screen.getByText("environments.surveys.edit.follow_ups")).toBeInTheDocument();
  });
});
