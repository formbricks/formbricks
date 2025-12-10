import { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { OptionIds } from "@/modules/survey/editor/components/option-ids";
import { UpdateElementId } from "@/modules/survey/editor/components/update-element-id";

interface AdvancedSettingsProps {
  element: TSurveyElement;
  elementIdx: number;
  localSurvey: TSurvey;
  updateElement: (elementIdx: number, updatedAttributes: any) => void;
  updateBlockLogic: (elementIdx: number, logic: TSurveyBlockLogic[]) => void;
  updateBlockLogicFallback: (elementIdx: number, logicFallback: string | undefined) => void;
  selectedLanguageCode: string;
}

export const AdvancedSettings = ({
  element,
  elementIdx,
  localSurvey,
  updateElement,
  selectedLanguageCode,
}: AdvancedSettingsProps) => {
  const showOptionIds =
    element.type === TSurveyElementTypeEnum.PictureSelection ||
    element.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
    element.type === TSurveyElementTypeEnum.MultipleChoiceMulti ||
    element.type === TSurveyElementTypeEnum.Ranking;

  return (
    <div className="flex flex-col gap-4">
      <UpdateElementId
        element={element}
        elementIdx={elementIdx}
        localSurvey={localSurvey}
        updateElement={updateElement}
      />

      {showOptionIds && (
        <OptionIds type="element" element={element} selectedLanguageCode={selectedLanguageCode} />
      )}
    </div>
  );
};
