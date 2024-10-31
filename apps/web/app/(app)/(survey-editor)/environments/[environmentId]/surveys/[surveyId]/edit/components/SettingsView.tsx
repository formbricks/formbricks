import { AdvancedTargetingCard } from "@formbricks/ee/advanced-targeting/components/advanced-targeting-card";
import { TActionClass } from "@formbricks/types/action-classes";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { HowToSendCard } from "./HowToSendCard";
import { RecontactOptionsCard } from "./RecontactOptionsCard";
import { ResponseOptionsCard } from "./ResponseOptionsCard";
import { SurveyPlacementCard } from "./SurveyPlacementCard";
import { TargetingCard } from "./TargetingCard";
import { WhenToSendCard } from "./WhenToSendCard";

interface SettingsViewProps {
  environment: TEnvironment;
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  segments: TSegment[];
  responseCount: number;
  membershipRole?: TOrganizationRole;
  isUserTargetingAllowed?: boolean;
  isFormbricksCloud: boolean;
  locale: string;
}

export const SettingsView = ({
  environment,
  localSurvey,
  setLocalSurvey,
  actionClasses,
  attributeClasses,
  segments,
  responseCount,
  membershipRole,
  isUserTargetingAllowed = false,
  isFormbricksCloud,
  locale,
}: SettingsViewProps) => {
  const isAppSurvey = localSurvey.type === "app";

  return (
    <div className="mt-12 space-y-3 p-5">
      <HowToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environment={environment}
        locale={locale}
      />

      {localSurvey.type === "app" ? (
        <div>
          {!isUserTargetingAllowed ? (
            <TargetingCard
              key={localSurvey.segment?.id}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              environmentId={environment.id}
              attributeClasses={attributeClasses}
              segments={segments}
              initialSegment={segments.find((segment) => segment.id === localSurvey.segment?.id)}
              isFormbricksCloud={isFormbricksCloud}
            />
          ) : (
            <AdvancedTargetingCard
              key={localSurvey.segment?.id}
              localSurvey={localSurvey}
              setLocalSurvey={setLocalSurvey}
              environmentId={environment.id}
              attributeClasses={attributeClasses}
              segments={segments}
              initialSegment={segments.find((segment) => segment.id === localSurvey.segment?.id)}
            />
          )}
        </div>
      ) : null}

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
    </div>
  );
};
