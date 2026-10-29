import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { type TWorkspaceWithoutCustomCss } from "@/modules/custom-css/lib/types";
import { ElementSettings } from "@/modules/survey/editor/components/element-settings";
import { RecodeSection } from "@/modules/survey/editor/components/recode-section";
import { TElementLock } from "@/modules/survey/editor/lib/published-lock";

interface AdvancedSettingsProps {
  element: TSurveyElement;
  elementIdx: number;
  localSurvey: TSurvey;
  lock: TElementLock;
  updateElement: (elementIdx: number, updatedAttributes: any) => void;
  updateBlockLogic: (elementIdx: number, logic: TSurveyBlockLogic[]) => void;
  updateBlockLogicFallback: (elementIdx: number, logicFallback: string | undefined) => void;
  workspace?: TWorkspaceWithoutCustomCss;
  isFormbricksCloud?: boolean;
}

/**
 * The body of a question's Settings tab: the question's own settings (order, display options,
 * validation rules), then the Recode section. The question ID is read-only and lives in the ⋯ menu (Copy question ID);
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
}: AdvancedSettingsProps) => {
  return (
    <div className="flex flex-col gap-6">
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
