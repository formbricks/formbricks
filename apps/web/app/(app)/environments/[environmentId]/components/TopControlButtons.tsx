"use client";

import { EnvironmentSwitch } from "@/app/(app)/environments/[environmentId]/components/EnvironmentSwitch";
import { CircleUserIcon, MessageCircleQuestionIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import formbricks from "@formbricks/js/app";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProductConfigChannel } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";

interface TopControlButtonsProps {
  environment: TEnvironment;
  environments: TEnvironment[];
  isFormbricksCloud: boolean;
  membershipRole?: TMembershipRole;
  currentProductChannel: TProductConfigChannel;
}

export const TopControlButtons = ({
  environment,
  environments,
  isFormbricksCloud,
  membershipRole,
  currentProductChannel,
}: TopControlButtonsProps) => {
  const router = useRouter();
  const showEnvironmentSwitch = currentProductChannel !== "link";
  return (
    <div className="z-50 flex items-center space-x-2">
      {showEnvironmentSwitch && <EnvironmentSwitch environment={environment} environments={environments} />}
      {isFormbricksCloud && (
        <Button
          variant="minimal"
          size="icon"
          tooltip="Share feedback"
          className="h-fit w-fit bg-slate-50 p-1"
          onClick={() => {
            formbricks.track("Top Menu: Product Feedback");
          }}>
          <MessageCircleQuestionIcon className="h-5 w-5" strokeWidth={1.5} />
        </Button>
      )}
      <Button
        variant="minimal"
        size="icon"
        tooltip="Account"
        className="h-fit w-fit bg-slate-50 p-1"
        onClick={() => {
          router.push(`/environments/${environment.id}/settings/profile`);
        }}>
        <CircleUserIcon strokeWidth={1.5} className="h-5 w-5" />
      </Button>
      {membershipRole && membershipRole !== "viewer" ? (
        <Button
          variant="secondary"
          size="icon"
          tooltip="New survey"
          className="h-fit w-fit p-1"
          onClick={() => {
            router.push(`/environments/${environment.id}/surveys/templates`);
          }}>
          <PlusIcon strokeWidth={1.5} className="h-5 w-5" />
        </Button>
      ) : null}
    </div>
  );
};
