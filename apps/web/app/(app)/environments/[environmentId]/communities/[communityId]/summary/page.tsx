import VerifiedImage from "@/images/illustrations/verified-rounded.svg";
import AddUserCommunityButton from "@/modules/communities/components/common/add-user-community-button";
import { CommunityStatCard } from "@/modules/communities/components/community/community-stat-card";
// import { CommunityClient } from "@/modules/communities/components/community/community-client";
import { getCommunity } from "@/modules/communities/lib/communities";
import AvailableEngagements from "@/modules/discover/components/Engagements/components/available-engagements";
import CompletedSurveys from "@/modules/discover/components/Engagements/components/completed-engagements";
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

  // console.log("Community:", community);

  return (
    <PageContentWrapper>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={"text-3xl font-bold capitalize text-slate-800"}>{community.communityName}</span>
          {community.whitelist && (
            <Image
              src={VerifiedImage as string}
              alt={t("verified check icon")}
              className="h-7 w-7"
              width={20}
              height={20}
            />
          )}
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

      <div className="grid grid-cols-2 gap-10 pt-10">
        <CommunityStatCard
          value={community.createdSurveys || 0}
          label={t("environments.community.total_engagements")}
          icon="note"
        />
        {/* <CommunityStatCard value="-" label={t("environments.community.total_rewards_given")} icon="trophy" /> */}
        <CommunityStatCard
          value={
            community.createdAt
              ? new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  year: "numeric",
                }).format(new Date(community.createdAt))
              : "N/A"
          }
          label={t("environments.community.community_created")}
          icon="heart"
        />
      </div>

      <div className="space-y-10 pt-10">
        <div className="text-2xl font-bold">
          {t("common.available_surveys")}
          <div className="grid grid-cols-3 gap-10">
            <AvailableEngagements searchQuery="" creatorId={community.id} />
          </div>
        </div>
        <div className="space-y-10">
          <div className="text-2xl font-bold">
            {t("common.completed_surveys")}
            <div className="grid grid-cols-3 gap-10">
              <CompletedSurveys searchQuery="" creatorId={community.id} showEmptyBorder={false} />
            </div>
          </div>
        </div>
      </div>

      {/* <CommunityClient environmentId={environment.id} community={community} /> */}

      {/* <SettingsId title={t("common.survey_id")} id={surveyId}></SettingsId> */}
    </PageContentWrapper>
  );
};

export default CommunityPage;
