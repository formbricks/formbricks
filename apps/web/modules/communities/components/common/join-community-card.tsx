import CommmunityPlaceholderOne from "@/images/illustrations/community-placeholder-1.png";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { ArrowRightIcon } from "lucide-react";
import { UsersRoundIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@formbricks/lib/cn";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface JoinCommunityCardProps {
  community: TUserWhitelistInfo;
  environmentId: string;
  className?: string;
}

export const JoinCommunityCard = ({ community, environmentId, className = "" }: JoinCommunityCardProps) => {
  const { t } = useTranslate();
  return (
    <div
      className={cn(
        "bg-primary-20 relative my-4 flex w-full flex-col rounded-xl border border-slate-200 shadow-sm",
        className
      )}>
      <div className="flex min-h-[200px] flex-row gap-4 p-4">
        <div className="flex h-full flex-col">
          <Image src={CommmunityPlaceholderOne} alt="Community Placeholder Image" />
        </div>
        <div className="flex h-full w-full flex-col justify-between gap-4">
          <div className="flex h-full flex-col justify-between">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">
                {community.name || community.email}
              </h3>
              <p className="text-base font-normal">Community description</p>
            </div>
            {community._count?.communityMembers !== undefined && (
              <div className="flex flex-row flex-nowrap gap-1 text-xs">
                <UsersRoundIcon className="h-4 w-4" />
                <span>Members: {community._count.communityMembers}</span>
              </div>
            )}
          </div>
          <div className="w-full">
            <Button
              aria-label={t("common.join")}
              onClick={() => {
                window.location.href = `/environments/${environmentId}/communities/${community.id}/summary`;
              }}
              className={cn(
                "bg-primary-50 ring-offset-background focus-visible:ring-ring group inline-flex h-10 w-full items-center justify-end gap-2 whitespace-nowrap rounded-md px-4 py-2 text-xs font-normal text-black transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 md:text-sm"
              )}>
              {t("common.join")}
              <ArrowRightIcon
                className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1 md:h-4 md:w-4"
                strokeWidth={2}
              />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
