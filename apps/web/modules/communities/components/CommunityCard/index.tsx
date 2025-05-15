import { cn } from "@formbricks/lib/cn";
import { TUserWhitelistInfo } from "@formbricks/types/user";

// import { useTranslate } from "@tolgee/react";

interface CommunityCardProps {
  community: TUserWhitelistInfo;
  className?: string;
}

export const CommunityCard = ({ community, className = "" }: CommunityCardProps) => {
  //   const { t } = useTranslate();

  return (
    <div
      className={cn(
        "relative my-4 flex w-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}>
      <div className="flex min-h-[200px] flex-col justify-between p-6 pb-3">
        Community Card Add/Remove button depending on if user has the community added already
        {community.id}
      </div>
    </div>
  );
};
