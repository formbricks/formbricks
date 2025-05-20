"use client";

import { getAvailableUserCommunitiesAction } from "@/modules/communities/actions";
import { AvailableCommunityCard } from "@/modules/communities/components/common/available-community-card";
import LoadingEngagementCard from "@/modules/discover/components/common/loading-card";
import React, { useCallback, useEffect, useState } from "react";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface AvailableCommunitiesProps {
  searchQuery?: string;
  environmentId: string;
}

export function AvailableCommunities({
  searchQuery,
  environmentId,
}: AvailableCommunitiesProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [communities, setCommunities] = useState<TUserWhitelistInfo[]>([]);

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
      <>
        <LoadingEngagementCard />
        <LoadingEngagementCard />
        <LoadingEngagementCard />
      </>
    );
  }

  return (
    <>
      {communities &&
        communities.length > 0 &&
        communities.map((community) => {
          return (
            <AvailableCommunityCard environmentId={environmentId} key={community.id} creator={community} />
          );
        })}
    </>
  );
}

export default AvailableCommunities;
