import HowToSendCard from "./HowToSendCard";
import RecontactOptionsCard from "./RecontactOptionsCard";
import ResponseOptionsCard from "./ResponseOptionsCard";
import WhenToSendCard from "./WhenToSendCard";
import WhoToSendCard from "./WhoToSendCard";
import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys" 
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TActionClass } from "@formbricks/types/v1/actionClasses";
import { TAttributeClass } from "@formbricks/types/v1/attributeClasses";

interface SettingsViewProps {
  environment: TEnvironment;
  localSurvey: TSurveyWithAnalytics;
  setLocalSurvey: (survey: TSurveyWithAnalytics) => void;
  eventClasses: TActionClass[],
  attributeClasses: TAttributeClass[]
}

export default function SettingsView({ environment, localSurvey, setLocalSurvey,eventClasses,attributeClasses }: SettingsViewProps) {
  return (
    <div className="mt-12 space-y-3 p-5">
      <HowToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environment={environment}
      />

      <WhoToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId={environment.id}
        attributeClasses={attributeClasses}
      />

      <WhenToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId={environment.id}
        eventClasses={eventClasses}
      />

      <ResponseOptionsCard localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />

      <RecontactOptionsCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId={environment.id}
      />
    </div>
  );
}
