import RemoveUserCommunityButton from "@/modules/communities/components/common/remove-user-community-button";
import ViewCommunityButton from "@/modules/communities/components/common/view-community-button";
import { cn } from "@formbricks/lib/cn";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface MyCommunityCardProps {
  creator: TUserWhitelistInfo;
  className?: string;
  environmentId: string;
}

export const MyCommunityCard = ({ creator, environmentId, className = "" }: MyCommunityCardProps) => {
  return (
    <div
      className={cn(
        "relative my-4 flex w-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}>
      <div className="flex min-h-[200px] flex-col justify-between p-6 pb-3">
        {creator.name || creator.email}
        <div className="space-y-2">
          <ViewCommunityButton creatorId={creator.id} environmentId={environmentId} />
          <RemoveUserCommunityButton creatorId={creator.id} />
        </div>
      </div>
    </div>
  );
};
