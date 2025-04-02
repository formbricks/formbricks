import { HowToSendCard } from "@/modules/survey/editor/components/how-to-send-card";
import { RecontactOptionsCard } from "@/modules/survey/editor/components/recontact-options-card";
import { ResponseOptionsCard } from "@/modules/survey/editor/components/response-options-card";
import { SurveyPlacementCard } from "@/modules/survey/editor/components/survey-placement-card";
import { SurveyVisibilityCard } from "@/modules/survey/editor/components/survey-visibility-card";
import { WhenToSendCard } from "@/modules/survey/editor/components/when-to-send-card";
import { ActionClass, Environment, OrganizationRole } from "@prisma/client";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { SurveyRewardCard } from "./survey-reward-card";

interface SettingsViewProps {
  environment: Pick<Environment, "id" | "appSetupCompleted">;
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  actionClasses: ActionClass[];
  segments: TSegment[];
  responseCount: number;
  membershipRole?: OrganizationRole;
}

export const SettingsView = ({
  environment,
  localSurvey,
  setLocalSurvey,
  actionClasses,
  responseCount,
  membershipRole,
}: SettingsViewProps) => {
  const isAppSurvey = localSurvey.type === "app";

  return (
    <div className="mt-12 space-y-3 p-5">
      <SurveyVisibilityCard localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />

      <HowToSendCard localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} environment={environment} />

      <WhenToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId={environment.id}
        propActionClasses={actionClasses}
        membershipRole={membershipRole}
      />

      <ResponseOptionsCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        responseCount={responseCount}
      />

      <RecontactOptionsCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId={environment.id}
      />

      {isAppSurvey && (
        <SurveyPlacementCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          environmentId={environment.id}
        />
      )}

      <SurveyRewardCard localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />
    </div>
  );
};
