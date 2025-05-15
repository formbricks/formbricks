"use client";

import { Communities } from "@/modules/communities/components/Communities";
import SearchSection from "@/modules/discover/components/common/search-section";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useState } from "react";

interface CommunitiesClientProps {
  translatedTitle: string;
}

export function CommunitiesClient({ translatedTitle }: CommunitiesClientProps) {
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
      {searchQuery}
      Communities Section here
      <Communities />
    </PageContentWrapper>
  );
}
