"use client";

import { getAvailableUserCommunitiesAction } from "@/modules/communities/actions";
import { JoinCommunityCard } from "@/modules/communities/components/common/join-community-card";
import LoadingEngagementCard from "@/modules/discover/components/common/loading-card";
import { useTranslate } from "@tolgee/react";
import React, { useCallback, useEffect, useState } from "react";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface PopularCommunitiesProps {
  searchQuery?: string;
  environmentId: string;
}

export function PopularCommunities({
  environmentId,
  searchQuery = "",
}: PopularCommunitiesProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [communities, setCommunities] = useState<TUserWhitelistInfo[]>([]);
  const { t } = useTranslate();
  // Fetching available communities
  const fetchCommunities = useCallback(async () => {
    setIsLoading(true);
    const data = await getAvailableUserCommunitiesAction({
      query: searchQuery,
    });
    if (data && data.data) {
      setCommunities(data.data);
    } else {
      setCommunities([]);
    }
    setIsLoading(false);
  }, [searchQuery]);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">
          {t("common.popular_communities")}
        </h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <LoadingEngagementCard />
          <LoadingEngagementCard />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-medium capitalize leading-6 text-slate-900">
        {t("common.popular_communities")}
      </h3>
      <div className="grid gap-4 lg:grid-cols-2">
        {communities &&
          communities.length > 0 &&
          communities.map((community) => {
            return (
              <JoinCommunityCard environmentId={environmentId} key={community.id} community={community} />
            );
          })}
      </div>
    </div>
  );
}

export default PopularCommunities;
