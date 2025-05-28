import RemoveUserCommunityButton from "@/modules/communities/components/common/remove-user-community-button";
import ViewCommunityButton from "@/modules/communities/components/common/view-community-button";
import { useTranslate } from "@tolgee/react";
import { UsersIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@formbricks/lib/cn";
import { TUserWhitelistInfo } from "@formbricks/types/user";

const defaultCommunityCardImg = "/illustrations/default-community-card.png";
const verifiedImg = "/illustrations/verified-rounded.svg";

interface MyCommunityCardProps {
  creator: TUserWhitelistInfo;
  className?: string;
  environmentId: string;
}

export const MyCommunityCard = ({ creator, environmentId, className = "" }: MyCommunityCardProps) => {
  const { t } = useTranslate();

  return (
    // NOTE:Width is controlled by parent component - Communities
    <div className={cn("relative my-4 flex w-full flex-col rounded-xl shadow-sm", className)}>
      <div className="relative h-[120px] w-full overflow-hidden rounded-t-xl">
        <Image
          src={defaultCommunityCardImg}
          alt={t("default-community-card-png")}
          fill
          className="object-cover"
          priority
        />
      </div>
      <div className="bg-primary-20 flex min-h-[200px] w-full flex-col justify-between rounded-b-xl p-6 pb-3">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <p className="line-clamp-1 text-lg font-medium">{creator.name || creator.email}</p>
            {/* TODO: Add verified check here and display if verified */}
            <Image
              src={verifiedImg as string}
              alt={t("verified check icon")}
              className="h-5 w-5"
              width={20}
              height={20}
            />
          </div>
          {/* TODO: Add community description here */}
          <p className="mb-4 line-clamp-2 text-sm text-slate-500">
            Community description placeholder goes here
          </p>
        </div>
        <div className="flex items-center pb-3 text-slate-700">
          <div className="flex items-center py-0.5 text-xs">
            <UsersIcon className="mr-1 h-4 w-4" strokeWidth={3} />
            {/* TODO: Add members here (see AvailableSurveyCard for reference) */}
            <div className="flex items-center gap-1">
              <span>Members: 1</span>
            </div>
          </div>
        </div>
        {/* TODO: Add number of engagements here (see AvailableSurveyCard for reference) */}
        {/* NOTE: Removing for now - coordinating with design */}
        {/* <div className="flex items-center pb-3 text-slate-700">
          <div className="flex items-center py-0.5 text-xs">
            <div className="flex items-center gap-1">
              <span># Engagements: 1</span>
            </div>
          </div>
        </div> */}
        <div className="space-y-2">
          <ViewCommunityButton creatorId={creator.id} environmentId={environmentId} />
          <RemoveUserCommunityButton creatorId={creator.id} />
        </div>
      </div>
    </div>
  );
};
