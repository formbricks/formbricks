"use client";

import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { TUserWhitelistInfo } from "@formbricks/types/user";

interface CommunityClientProps {
  community: TUserWhitelistInfo;
  environmentId: string;
}

export function CommunityClient({ community }: CommunityClientProps) {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={community.communityName} />
      Community Page!
      {community.name}
      {community.id}
    </PageContentWrapper>
  );
}
