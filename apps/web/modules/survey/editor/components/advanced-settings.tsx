import type { ReactNode } from "react";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { type TWorkspaceWithoutCustomCss } from "@/modules/custom-css/lib/types";
import { ElementSettings } from "@/modules/survey/editor/components/element-settings";
import { RecodeSection } from "@/modules/survey/editor/components/recode-section";
import { TElementLock } from "@/modules/survey/editor/lib/published-lock";

interface AdvancedSettingsProps {
  readonly element: TSurveyElement;
  readonly elementIdx: number;
  readonly localSurvey: TSurvey;
  readonly lock: TElementLock;
  readonly updateElement: (elementIdx: number, updatedAttributes: any) => void;
  readonly workspace?: TWorkspaceWithoutCustomCss;
  readonly isFormbricksCloud?: boolean;
  /** "Show question if…" and "Show options if…" (ENG-6949), first on the tab. */
  readonly showIfSettings?: ReactNode;
}

/**
 * The body of a question's Settings tab: its show-if, the question's own settings (order, display
 * options, validation rules), then the Recode section. The question ID is read-only and lives in the ⋯ menu (Copy question ID);
 * each option's ID is copied from the button beside its input.
 */
export const AdvancedSettings = ({
  element,
  elementIdx,
  localSurvey,
  lock,
  updateElement,
  workspace,
  isFormbricksCloud,
  showIfSettings,
}: AdvancedSettingsProps) => {
  return (
    <div className="flex flex-col gap-6">
      {showIfSettings}
      <ElementSettings
        element={element}
        elementIdx={elementIdx}
        updateElement={updateElement}
        workspace={workspace}
        isFormbricksCloud={isFormbricksCloud}
      />

      <RecodeSection
        element={element}
        elementIdx={elementIdx}
        localSurvey={localSurvey}
        lock={lock}
        updateElement={updateElement}
      />
    </div>
  );
};
