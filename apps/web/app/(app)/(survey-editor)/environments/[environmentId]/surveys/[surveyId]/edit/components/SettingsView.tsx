import { TargetingLockedCard } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/TargetingLockedCard";
import { TargetingCard } from "@/modules/ee/contacts/segments/components/targeting-card";
import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { TActionClass } from "@formbricks/types/action-classes";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { HowToSendCard } from "./HowToSendCard";
import { RecontactOptionsCard } from "./RecontactOptionsCard";
import { ResponseOptionsCard } from "./ResponseOptionsCard";
import { SurveyPlacementCard } from "./SurveyPlacementCard";
import { WhenToSendCard } from "./WhenToSendCard";

interface SettingsViewProps {
  environment: TEnvironment;
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  actionClasses: TActionClass[];
  contactAttributeKeys: TContactAttributeKey[];
  segments: TSegment[];
  responseCount: number;
  membershipRole?: TOrganizationRole;
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
