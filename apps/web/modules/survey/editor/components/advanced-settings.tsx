import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ElementSettings } from "@/modules/survey/editor/components/element-settings";
import { OptionIds } from "@/modules/survey/editor/components/option-ids";
import { RecodeSection } from "@/modules/survey/editor/components/recode-section";
import { UpdateElementId } from "@/modules/survey/editor/components/update-element-id";

interface AdvancedSettingsProps {
  element: TSurveyElement;
  elementIdx: number;
  localSurvey: TSurvey;
  updateElement: (elementIdx: number, updatedAttributes: any) => void;
  updateBlockLogic: (elementIdx: number, logic: TSurveyBlockLogic[]) => void;
  updateBlockLogicFallback: (elementIdx: number, logicFallback: string | undefined) => void;
}

/**
 * The body of a question's Settings tab: the question's own settings (order, display options,
 * validation rules), then the Recode section, then the identifiers.
 */
export const AdvancedSettings = ({
  element,
  elementIdx,
  localSurvey,
  updateElement,
}: AdvancedSettingsProps) => {
  const showOptionIds =
    element.type === TSurveyElementTypeEnum.PictureSelection ||
    element.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
    element.type === TSurveyElementTypeEnum.MultipleChoiceMulti ||
    element.type === TSurveyElementTypeEnum.Ranking;

  return (
    <div className="flex flex-col gap-6">
      <ElementSettings element={element} elementIdx={elementIdx} updateElement={updateElement} />

      <RecodeSection
        element={element}
        elementIdx={elementIdx}
        localSurvey={localSurvey}
        updateElement={updateElement}
      />

      <UpdateElementId
        element={element}
        elementIdx={elementIdx}
        localSurvey={localSurvey}
        updateElement={updateElement}
      />

      {showOptionIds && <OptionIds type="element" element={element} />}
    </div>
  );
};
