import { TargetingCard } from "@/modules/ee/contacts/segments/components/targeting-card";
import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { HowToSendCard } from "@/modules/survey/editor/components/how-to-send-card";
import { RecontactOptionsCard } from "@/modules/survey/editor/components/recontact-options-card";
import { ResponseOptionsCard } from "@/modules/survey/editor/components/response-options-card";
import { SurveyPlacementCard } from "@/modules/survey/editor/components/survey-placement-card";
import { SurveyVisibilityCard } from "@/modules/survey/editor/components/survey-visibility-card";
import { TargetingLockedCard } from "@/modules/survey/editor/components/targeting-locked-card";
import { WhenToSendCard } from "@/modules/survey/editor/components/when-to-send-card";
import { ActionClass, Environment, OrganizationRole } from "@prisma/client";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SettingsViewProps {
  environment: Pick<Environment, "id" | "appSetupCompleted">;
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  actionClasses: ActionClass[];
  contactAttributeKeys: TContactAttributeKey[];
  segments: TSegment[];
  responseCount: number;
  membershipRole?: OrganizationRole;
  isUserTargetingAllowed?: boolean;
  projectPermission: TTeamPermission | null;
  isFormbricksCloud: boolean;
}

export const SettingsView = ({
  environment,
  localSurvey,
  setLocalSurvey,
  actionClasses,
  contactAttributeKeys,
  segments,
  responseCount,
  membershipRole,
  isUserTargetingAllowed = false,
  projectPermission,
  isFormbricksCloud,
}: SettingsViewProps) => {
  const isAppSurvey = localSurvey.type === "app";

  return (
    <div className="mt-12 space-y-3 p-5">
      <SurveyVisibilityCard localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />

      <HowToSendCard localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} environment={environment} />

      {localSurvey.type === "app" ? (
        <div>
          {isUserTargetingAllowed ? (
            <div className="relative">
              <div className="blur-none">
                <TargetingCard
                  key={localSurvey.segment?.id}
                  localSurvey={localSurvey}
                  setLocalSurvey={setLocalSurvey}
                  environmentId={environment.id}
                  contactAttributeKeys={contactAttributeKeys}
                  segments={segments}
                  initialSegment={segments.find((segment) => segment.id === localSurvey.segment?.id)}
                />
              </div>
            </div>
          ) : (
            <TargetingLockedCard isFormbricksCloud={isFormbricksCloud} environmentId={environment.id} />
          )}
        </div>
      ) : null}

      <WhenToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId={environment.id}
        propActionClasses={actionClasses}
        membershipRole={membershipRole}
        projectPermission={projectPermission}
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
    </div>
  );
};
