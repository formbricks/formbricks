"use client";

import AvailableCommunities from "@/modules/communities/components/communities/available-communities";
import MyCommunities from "@/modules/communities/components/communities/my-communities";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useCallback, useEffect, useState } from "react";
import { TUserWhitelistInfo } from "@formbricks/types/user";
import { getAvailableUserCommunitiesAction, getCurrentUserCommunitiesAction } from "../../actions";

interface CommunitiesClientProps {
  translatedTitle: string;
  environmentId: string;
}

export function CommunitiesClient({ environmentId, translatedTitle }: CommunitiesClientProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [myCommunities, setMyCommunities] = useState<TUserWhitelistInfo[]>([]);
  const [availableCommunities, setAvailableCommunities] = useState<TUserWhitelistInfo[]>([]);
  const [showMore, setShowMore] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [myCommunitiesRes, availableCommunitiesRes] = await Promise.all([
        getCurrentUserCommunitiesAction({ query: "" }),
        getAvailableUserCommunitiesAction({ query: "" }),
      ]);

      if (myCommunitiesRes && myCommunitiesRes.data) {
        setMyCommunities(myCommunitiesRes.data);
      }

      if (availableCommunitiesRes && availableCommunitiesRes.data) {
        setAvailableCommunities(availableCommunitiesRes.data);

        if (availableCommunitiesRes && availableCommunitiesRes.data) {
          setAvailableCommunities(availableCommunitiesRes.data);
        }
      }
    } catch (error) {
      console.error("Error fetching communities:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleShowMoreAvailable = () => {
    setShowMore(true);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={translatedTitle} />

      <AvailableCommunities
        environmentId={environmentId}
        communities={
          myCommunities.length == 0 || showMore ? availableCommunities : availableCommunities.slice(0, 4)
        }
        totalCount={availableCommunities.length}
        isLoading={isLoading}
        showMore={showMore}
        hasMyCommunities={myCommunities.length > 0}
        onShowMore={handleShowMoreAvailable}
      />
      {myCommunities.length > 0 && (
        <MyCommunities environmentId={environmentId} communities={myCommunities} isLoading={isLoading} />
      )}
    </PageContentWrapper>
  );
}
