import { CommunityClient } from "@/modules/communities/community/components/community-client";
import { getCommunity } from "@/modules/communities/lib/communities";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { notFound } from "next/navigation";

const CommunityPage = async (props: { params: Promise<{ environmentId: string; communityId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { environment } = await getEnvironmentAuth(params.environmentId);

  const communityId = params.communityId;

  if (!communityId) {
    return notFound();
  }

  const community = await getCommunity({ communityId });

  if (!community) {
    throw new Error(t("common.community_not_found"));
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={community.name}></PageHeader>
      <CommunityClient environmentId={environment.id} community={community} />

      {/* <SettingsId title={t("common.survey_id")} id={surveyId}></SettingsId> */}
    </PageContentWrapper>
  );
};

export default CommunityPage;
