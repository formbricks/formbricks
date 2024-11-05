"use client";

import { EnvironmentSwitch } from "@/app/(app)/environments/[environmentId]/components/EnvironmentSwitch";
import { TTeamPermission } from "@/modules/ee/teams/product-teams/types/teams";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { CircleUserIcon, MessageCircleQuestionIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import formbricks from "@formbricks/js";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { Button } from "@formbricks/ui/components/Button";

interface TopControlButtonsProps {
  environment: TEnvironment;
  environments: TEnvironment[];
  isFormbricksCloud: boolean;
  membershipRole?: TOrganizationRole;
  productPermission: TTeamPermission | null;
}

export const TopControlButtons = ({
  environment,
  environments,
  isFormbricksCloud,
  membershipRole,
  productPermission,
}: TopControlButtonsProps) => {
  const t = useTranslations();
  const router = useRouter();

  const { isMember, isBilling } = getAccessFlags(membershipRole);
  const { hasReadAccess } = getTeamPermissionFlags(productPermission);
  const isReadOnly = isMember && hasReadAccess;

  return (
    <div className="z-50 flex items-center space-x-2">
      {!isBilling && <EnvironmentSwitch environment={environment} environments={environments} />}
      {isFormbricksCloud && (
        <Button
          variant="minimal"
          size="icon"
          tooltip={t("common.share_feedback")}
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
        tooltip={t("common.account")}
        className="h-fit w-fit bg-slate-50 p-1"
        onClick={() => {
          router.push(`/environments/${environment.id}/settings/profile`);
        }}>
        <CircleUserIcon strokeWidth={1.5} className="h-5 w-5" />
      </Button>
      {isBilling || isReadOnly ? (
        <></>
      ) : (
        <Button
          variant="secondary"
          size="icon"
          tooltip={t("common.new_survey")}
          className="h-fit w-fit p-1"
          onClick={() => {
            router.push(`/environments/${environment.id}/surveys/templates`);
          }}>
          <PlusIcon strokeWidth={1.5} className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
};
