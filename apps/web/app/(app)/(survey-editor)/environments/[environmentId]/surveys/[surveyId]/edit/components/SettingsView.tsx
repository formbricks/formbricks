import { AdvancedTargetingCard } from "@formbricks/ee/advanced-targeting/components/advanced-targeting-card";
import { TActionClass } from "@formbricks/types/action-classes";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
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
  organizationId: string;
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  segments: TSegment[];
  responseCount: number;
  membershipRole?: TMembershipRole;
  isUserTargetingAllowed?: boolean;
  isFormbricksCloud: boolean;
  product: TProduct;
}

export const SettingsView = ({
  environment,
  organizationId,
  localSurvey,
  setLocalSurvey,
  actionClasses,
  attributeClasses,
  segments,
  responseCount,
  membershipRole,
  isUserTargetingAllowed = false,
  isFormbricksCloud,
  product,
}: SettingsViewProps) => {
  const isWebSurvey = localSurvey.type === "website" || localSurvey.type === "app";

  return (
    <div className="mt-12 space-y-3 p-5">
      <HowToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environment={environment}
        product={product}
        organizationId={organizationId}
      />

      {localSurvey.type === "app" ? (
        !isUserTargetingAllowed ? (
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
            actionClasses={actionClasses}
            segments={segments}
            initialSegment={segments.find((segment) => segment.id === localSurvey.segment?.id)}
          />
        )
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

      {isWebSurvey && (
        <SurveyPlacementCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          environmentId={environment.id}
        />
      )}
    </div>
  );
};
