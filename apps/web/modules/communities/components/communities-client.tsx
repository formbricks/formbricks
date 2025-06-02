"use client";

import MyCommunities from "@/modules/communities/components/Communities/components/my-communities";
import PopularCommunities from "@/modules/communities/components/Communities/components/popular-communities";
import RisingCommunities from "@/modules/communities/components/Communities/components/rising-communities";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

interface CommunitiesClientProps {
  translatedTitle: string;
  environmentId: string;
}

export function CommunitiesClient({ environmentId, translatedTitle }: CommunitiesClientProps) {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={translatedTitle} />
      <PopularCommunities environmentId={environmentId} />
      <MyCommunities environmentId={environmentId} />
      <RisingCommunities environmentId={environmentId} />
    </PageContentWrapper>
  );
}
