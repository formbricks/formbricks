"use client";

import { Communities } from "@/modules/communities/components/Communities";
import SearchSection from "@/modules/discover/components/common/search-section";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useState } from "react";

interface CommunitiesClientProps {
  translatedTitle: string;
  environmentId: string;
}

export function CommunitiesClient({ environmentId, translatedTitle }: CommunitiesClientProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={translatedTitle}
        cta={
          <div>
            <SearchSection setSearchQuery={setSearchQuery} />
          </div>
        }
      />
      <Communities environmentId={environmentId} searchQuery={searchQuery} />
    </PageContentWrapper>
  );
}
