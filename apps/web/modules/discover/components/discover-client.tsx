"use client";

import Engagements from "@/modules/discover/components/Engagements";
import SearchSection from "@/modules/discover/components/common/search-section";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useState } from "react";

interface DiscoverClientProps {
  communityId: string;
  translatedTitle: string | React.ReactNode;
  translatedSubTitle?: string;
  bannerImage?: string;
}

export function DiscoverClient({
  translatedTitle,
  translatedSubTitle,
  bannerImage,
  communityId,
}: DiscoverClientProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("updatedAt");

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={translatedTitle}
        pageSubTitle={translatedSubTitle}
        pageBannerImage={bannerImage}
        hideBottomBorder={true}
        ctaVertical={
          <div>
            <SearchSection setSearchQuery={setSearchQuery} sortBy={sortBy} setSortBy={setSortBy} />
          </div>
        }
      />
      <Engagements
        communityId={communityId}
        searchQuery={searchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />
    </PageContentWrapper>
  );
}
