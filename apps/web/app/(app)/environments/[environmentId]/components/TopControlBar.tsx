import { TopControlButtons } from "@/app/(app)/environments/[environmentId]/components/TopControlButtons";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";

interface SideBarProps {
  environment: TEnvironment;
  environments: TEnvironment[];
  membershipRole?: TMembershipRole;
}

export const TopControlBar = ({ environment, environments, membershipRole }: SideBarProps) => {
  return (
    <div className="fixed inset-0 top-0 z-30 flex h-14 w-full items-center justify-end bg-slate-50 px-6 shadow-[0_2px_4px_rgba(0,0,0,0.02),0_1px_0_rgba(0,0,0,0.06)]">
      <div className="shadow-xs z-10">
        <div className="flex w-fit items-center space-x-2 py-2">
          <TopControlButtons
            environment={environment}
            environments={environments}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
            membershipRole={membershipRole}
          />
        </div>
      </div>
    </div>
  );
};
