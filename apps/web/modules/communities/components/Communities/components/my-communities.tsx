"use client";

import { getCurrentUserCommunitiesAction } from "@/modules/communities/actions";
import { MyCommunityCard } from "@/modules/communities/components/common/my-community-card";
import LoadingEngagementCard from "@/modules/discover/components/common/loading-card";
import React, { useCallback, useEffect, useState } from "react";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface MyCommunitiesProps {
  searchQuery?: string;
  environmentId: string;
}

export function MyComunities({ searchQuery, environmentId }: MyCommunitiesProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [communities, setCommunities] = useState<TUserWhitelistInfo[]>([]);

  // Fetching available communities
  const fetchCommunities = useCallback(async () => {
    setIsLoading(true);
    const data = await getCurrentUserCommunitiesAction({
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
          return <MyCommunityCard environmentId={environmentId} key={community.id} creator={community} />;
        })}
    </>
  );
}

export default MyComunities;
