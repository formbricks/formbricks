import ViewCommunityButton from "@/modules/communities/components/common/view-community-button";
import AddUserCommunityButton from "@/modules/communities/components/community/add-user-community-button";
import { cn } from "@formbricks/lib/cn";
import { TUserWhitelistInfo } from "@formbricks/types/user";

// import { useTranslate } from "@tolgee/react";

interface AvailableCommunityCardProps {
  creator: TUserWhitelistInfo;
  environmentId: string;
  className?: string;
}

export const AvailableCommunityCard = ({
  creator,
  environmentId,
  className = "",
}: AvailableCommunityCardProps) => {
  //   const { t } = useTranslate();

  return (
    <div
      className={cn(
        "relative my-4 flex w-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}>
      <div className="flex min-h-[200px] flex-col justify-between p-6 pb-3">
        {creator.name || creator.email}
        <div className="space-y-2">
          <AddUserCommunityButton creatorId={creator.id} />
          <ViewCommunityButton creatorId={creator.id} environmentId={environmentId} />
        </div>
      </div>
    </div>
  );
};
