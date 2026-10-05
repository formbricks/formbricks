"use client";

import { type Dispatch, type SetStateAction } from "react";
import { type TCustomCssAppearance, type TCustomCssStored } from "@formbricks/types/custom-css";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { CustomCssCard } from "./custom-css-card";
import { CustomCssPlanNotice } from "./custom-css-plan-notice";
import { InheritedWorkspaceCss } from "./inherited-workspace-css";
import {
  type TCustomCssDraft,
  applyCustomCssDraftToStored,
  getCustomCssSource,
  toCustomCssDraft,
} from "./lib/draft";
import { getCustomCssEditMode } from "./lib/edit-mode";
import { type TCustomCssValidationState } from "./lib/validation";
import { type TSurveyCustomCssEditorConfig } from "./types";

interface SurveyCustomCssCardProps {
  config: TSurveyCustomCssEditorConfig;
  localSurvey: TSurvey;
  setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  /** The survey as last persisted, so an unchanged field keeps its saved entry. */
  savedCustomCss: TCustomCssStored | null | undefined;
  /** Run by the editor, which also feeds the preview from it. */
  validation: TCustomCssValidationState;
  appearance: TCustomCssAppearance;
  lookAndFeelHref: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

/**
 * Survey Custom CSS in the Styling tab (ENG-3553). Independent of "Add custom styles": survey CSS
 * adds on top of the workspace CSS whether or not the survey overrides the theme (D16). Edits go into
 * the working copy of the survey and are saved — and validated again — by the editor's normal save
 * and publish, which is what the survey's own edit permission already governs.
 */
export const SurveyCustomCssCard = ({
  config,
  localSurvey,
  setLocalSurvey,
  savedCustomCss,
  validation,
  appearance,
  lookAndFeelHref,
  open,
  setOpen,
}: Readonly<SurveyCustomCssCardProps>) => {
  const mode = getCustomCssEditMode({ canEdit: true, planAllowed: config.planAllowed });
  const draft = toCustomCssDraft(getCustomCssSource(localSurvey.customCss));

  const handleDraftChange = (next: TCustomCssDraft) => {
    setLocalSurvey((previous) => ({
      ...previous,
      customCss: applyCustomCssDraftToStored(savedCustomCss, next),
    }));
  };

  const hasSavedCss = getCustomCssSource(savedCustomCss) !== null;
  const isPlanLocked = mode === "clear-only";
  const inherited = (
    <InheritedWorkspaceCss
      source={config.workspace.source}
      status={config.workspace.status}
      appearance={appearance}
      lookAndFeelHref={lookAndFeelHref}
    />
  );

  return (
    <CustomCssCard
      scope="survey"
      appearance={appearance}
      draft={draft}
      onDraftChange={handleDraftChange}
      validation={validation}
      mode={mode}
      savedStatus={config.surveyStatus}
      hasHeadScriptStyles={config.hasHeadScriptStyles}
      notice={
        isPlanLocked && hasSavedCss ? (
          <CustomCssPlanNotice billingHref={config.billingHref} hasSavedCss />
        ) : undefined
      }
      lockedContent={
        // Nothing of its own to show or clear: the inherited CSS still applies, so it stays visible.
        isPlanLocked && !hasSavedCss ? (
          <div className="flex flex-col gap-4 p-6 pt-2">
            {inherited}
            <CustomCssPlanNotice billingHref={config.billingHref} hasSavedCss={false} />
          </div>
        ) : undefined
      }
      inherited={inherited}
      open={open}
      setOpen={setOpen}
    />
  );
};
