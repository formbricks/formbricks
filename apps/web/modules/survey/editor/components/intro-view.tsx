import { SurveyDescriptionCard } from "@/modules/survey/editor/components/survey-description-card";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SettingsViewProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
}

export const IntroView = ({ localSurvey, setLocalSurvey }: SettingsViewProps) => {
  return (
    <div className="mt-12 space-y-3 p-5">
      <SurveyDescriptionCard localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />
    </div>
  );
};
