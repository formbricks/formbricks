"use client";

import { JoinCommunityCard } from "@/modules/communities/components/common/join-community-card";
import LoadingEngagementCard from "@/modules/discover/components/common/loading-card";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import React from "react";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface AvailableCommunitiesProps {
  communities: TUserWhitelistInfo[];
  totalCount: number;
  isLoading: boolean;
  showMore: boolean;
  hasMyCommunities: boolean;
  onShowMore: () => void;
  environmentId: string;
}

export function AvailableCommunities({
  communities,
  totalCount,
  isLoading,
  showMore,
  hasMyCommunities,
  onShowMore,
  environmentId,
}: AvailableCommunitiesProps): React.JSX.Element {
  const { t } = useTranslate();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">{t("common.communities")}</h3>
        <div className="grid md:grid-cols-2 md:gap-4">
          <LoadingEngagementCard />
          <LoadingEngagementCard />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">{t("common.communities")}</h3>
      <div className="grid md:grid-cols-2 md:gap-4">
        {communities?.map((community) => (
          <JoinCommunityCard environmentId={environmentId} key={community.id} community={community} />
        ))}
      </div>

      {hasMyCommunities && !showMore && totalCount > 4 && (
        <div className="mt-4 flex justify-center">
          <Button onClick={onShowMore} variant="outline" className="px-6">
            {t("common.show_more")}
          </Button>
        </div>
      )}
    </div>
  );
}

export default AvailableCommunities;
