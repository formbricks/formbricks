"use client";

import { MyCommunityCard } from "@/modules/communities/components/common/my-community-card";
import LoadingEngagementCard from "@/modules/discover/components/common/loading-card";
import { useTranslate } from "@tolgee/react";
import React from "react";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface MyCommunitiesProps {
  communities: TUserWhitelistInfo[];
  isLoading: boolean;
  environmentId: string;
}

export function MyComunities({
  communities,
  isLoading,
  environmentId,
}: MyCommunitiesProps): React.JSX.Element {
  const { t } = useTranslate();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">
          {t("common.communities_i_joined")}
        </h3>
        <div className="grid md:grid-cols-2 md:gap-4 lg:grid-cols-4">
          <LoadingEngagementCard />
          <LoadingEngagementCard />
          <LoadingEngagementCard />
          <LoadingEngagementCard />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">
        {t("common.communities_i_joined")}
      </h3>
      <div className="grid md:grid-cols-2 md:gap-4 lg:grid-cols-4">
        {communities &&
          communities.length > 0 &&
          communities.map((community) => {
            return <MyCommunityCard environmentId={environmentId} key={community.id} creator={community} />;
          })}
      </div>
    </div>
  );
}

export default MyComunities;
