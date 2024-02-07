import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys";

import HowToSendCard from "./HowToSendCard";
import RecontactOptionsCard from "./RecontactOptionsCard";
import ResponseOptionsCard from "./ResponseOptionsCard";
import StylingCard from "./StylingCard";
import UserTargetingAdvancedCard from "./UserTargetingAdvancedCard";
import UserTargetingCard from "./UserTargetingCard";
import WhenToSendCard from "./WhenToSendCard";

interface SettingsViewProps {
  environment: TEnvironment;
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  segments: TSegment[];
  responseCount: number;
  membershipRole?: TMembershipRole;
  colours: string[];
  isUserTargetingAllowed?: boolean;
}

export default function SettingsView({
  environment,
  localSurvey,
  setLocalSurvey,
  actionClasses,
  attributeClasses,
  segments,
  responseCount,
  membershipRole,
  colours,
  isUserTargetingAllowed = false,
}: SettingsViewProps) {
  return (
    <div className="mt-12 space-y-3 p-5">
      <HowToSendCard localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} environment={environment} />

      {localSurvey.type === "web" ? (
        !isUserTargetingAllowed ? (
          <UserTargetingCard
            key={localSurvey.segment?.id}
            localSurvey={localSurvey}
            setLocalSurvey={setLocalSurvey}
            environmentId={environment.id}
            attributeClasses={attributeClasses}
          />
        ) : (
          <UserTargetingAdvancedCard
            key={localSurvey.segment?.id}
            localSurvey={localSurvey}
            setLocalSurvey={setLocalSurvey}
            environmentId={environment.id}
            attributeClasses={attributeClasses}
            actionClasses={actionClasses}
            segments={segments}
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

      <StylingCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        colours={colours}
        environmentId={environment.id}
      />
    </div>
  );
}
