import VerifiedImage from "@/images/illustrations/verified-rounded.svg";
import AddUserCommunityButton from "@/modules/communities/components/common/add-user-community-button";
// import { CommunityStatCard } from "@/modules/communities/components/community/community-stat-card";
// import { CommunityClient } from "@/modules/communities/components/community/community-client";
import { getCommunity } from "@/modules/communities/lib/communities";
// import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { getTranslate } from "@/tolgee/server";
import Image from "next/image";
import { notFound } from "next/navigation";

const CommunityPage = async (props: { params: Promise<{ environmentId: string; communityId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  // const { environment } = await getEnvironmentAuth(params.environmentId);

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={"text-3xl font-bold capitalize text-slate-800"}>{community.communityName}</span>
          <Image
            src={VerifiedImage as string}
            alt={t("verified check icon")}
            className="h-7 w-7"
            width={20}
            height={20}
          />
        </div>
        <div className="max-w-xs">
          <AddUserCommunityButton creatorId={community.id} />
        </div>
      </div>

      <div>
        <div>
          {community.communityDescription ? (
            <p className="mt-2 text-lg">{community.communityDescription}</p>
          ) : null}
        </div>
      </div>

      {/* <div className="grid grid-cols-3 gap-10">
        <CommunityStatCard />
        <CommunityStatCard />
        <CommunityStatCard />
      </div> */}

      {/* <CommunityClient environmentId={environment.id} community={community} /> */}

      {/* <SettingsId title={t("common.survey_id")} id={surveyId}></SettingsId> */}
    </PageContentWrapper>
  );
};

export default CommunityPage;
