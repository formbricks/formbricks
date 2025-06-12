import VerifiedImage from "@/images/illustrations/verified-rounded.svg";
import CommunityActions from "@/modules/communities/components/community/community-actions";
import { CommunityStatCard } from "@/modules/communities/components/community/community-stat-card";
import MembersModal from "@/modules/communities/components/community/members-modal";
import { getCommunity } from "@/modules/communities/lib/communities";
import AvailableEngagements from "@/modules/discover/components/Engagements/components/available-engagements";
import CompletedSurveys from "@/modules/discover/components/Engagements/components/completed-engagements";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { getTranslate } from "@/tolgee/server";
import Image from "next/image";
import { notFound } from "next/navigation";

const CommunityPage = async (props: { params: Promise<{ environmentId: string; communityId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session } = await getEnvironmentAuth(params.environmentId);
  const currentUserId = session?.user.id;

  const communityId = params.communityId;

  if (!communityId) {
    return notFound();
  }

  const community = await getCommunity({ communityId });

  if (!community) {
    throw new Error(t("common.community_not_found"));
  }

  console.log("Community:", community);

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
        <CommunityActions community={community} currentUserId={currentUserId} />
      </div>

      <div className="flex justify-between gap-4 pt-4">
        <div className="max-w-2xl">
          {community.communityDescription ? (
            <p className="mt-2 text-lg">{community.communityDescription}</p>
          ) : null}
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-800">
              {t("common.members")} ({community.members?.length || 0})
            </h2>
            {community.members && community.members.length > 0 && (
              <MembersModal members={community.members} />
            )}
          </div>

          <div className="flex flex-wrap items-center">
            {community.members && community.members.length > 0 ? (
              <div className="flex -space-x-3 overflow-visible">
                {community.members.slice(0, 10).map((member, idx) => (
                  <div key={member.id} className="relative" style={{ zIndex: idx }}>
                    <div className="h-11 w-11 overflow-hidden rounded-full border-2 border-white">
                      {member.imageUrl ? (
                        <Image
                          src={member.imageUrl}
                          alt={member.name || "Member"}
                          width={44}
                          height={44}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="bg-primary-100 text-primary-800 flex h-full w-full items-center justify-center text-base font-medium">
                          {(member.name && member.name.charAt(0)) ||
                            (member.email && member.email.charAt(0)) ||
                            "?"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
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
