import UserTargetingCard from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/UserTargetingCard";

import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TSurvey } from "@formbricks/types/surveys";
import { TUserSegment } from "@formbricks/types/userSegment";

import HowToSendCard from "./HowToSendCard";
import RecontactOptionsCard from "./RecontactOptionsCard";
import ResponseOptionsCard from "./ResponseOptionsCard";
import StylingCard from "./StylingCard";
import UserTargetingAdvancedCard from "./UserTargetingAdvancedCard";
import WhenToSendCard from "./WhenToSendCard";

interface SettingsViewProps {
  environment: TEnvironment;
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  userSegments: TUserSegment[];
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
  userSegments,
  responseCount,
  membershipRole,
  colours,
  isUserTargetingAllowed = false,
}: SettingsViewProps) {
  return (
    <div className="mt-12 space-y-3 p-5">
      <HowToSendCard localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} environment={environment} />

      {isUserTargetingAllowed ? (
        <UserTargetingAdvancedCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          environmentId={environment.id}
          attributeClasses={attributeClasses}
          actionClasses={actionClasses}
          userSegments={userSegments}
        />
      ) : (
        <UserTargetingCard localSurvey={localSurvey} environmentId={environment.id} />
      )}

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
