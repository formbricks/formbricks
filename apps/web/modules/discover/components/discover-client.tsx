"use client";

import Engagements from "@/modules/discover/components/Engagements";
import SearchSection from "@/modules/discover/components/common/search-section";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useState } from "react";

interface DiscoverClientProps {
  communityId: string;
  translatedTitle: string;
}

export function DiscoverClient({ translatedTitle, communityId }: DiscoverClientProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={translatedTitle}
        cta={
          <div className="w-72">
            <SearchSection setSearchQuery={setSearchQuery} />
          </div>
        }
      />
      <Engagements communityId={communityId} searchQuery={searchQuery} />
    </PageContentWrapper>
  );
}
