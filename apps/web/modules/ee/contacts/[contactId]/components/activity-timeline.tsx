"use client";

import { ArrowDownUpIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TDisplay } from "@formbricks/types/displays";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { useMembershipRole } from "@/lib/membership/hooks/useMembershipRole";
import { getAccessFlags } from "@/lib/membership/utils";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { DisplayCard } from "./display-card";
import { ResponseSurveyCard } from "./response-survey-card";

type TTimelineItem =
  | { type: "display"; data: Pick<TDisplay, "id" | "createdAt" | "surveyId">; survey: TSurvey }
  | { type: "response"; data: TResponseWithQuotas; survey: TSurvey };

interface ActivityTimelineProps {
  surveys: TSurvey[];
  user: TUser;
  responses: TResponseWithQuotas[];
  displays: Pick<TDisplay, "id" | "createdAt" | "surveyId">[];
  workspaceId: string;
  environmentTags: TTag[];
  locale: TUserLocale;
  workspacePermission: TTeamPermission | null;
}

export const ActivityTimeline = ({
  surveys,
  user,
  responses: initialResponses,
  displays,
  workspaceId,
  environmentTags,
  locale,
  workspacePermission,
}: Readonly<ActivityTimelineProps>) => {
  const { t } = useTranslation();
  const [responses, setResponses] = useState(initialResponses);
  const [isReversed, setIsReversed] = useState(false);

  const { membershipRole } = useMembershipRole(workspaceId, user.id);

  const isReadOnly = useMemo(() => {
    const { isMember } = getAccessFlags(membershipRole);
    const { hasReadAccess } = getTeamPermissionFlags(workspacePermission);
    return isMember && hasReadAccess;
  }, [membershipRole, workspacePermission]);

  useEffect(() => {
    setResponses(initialResponses);
  }, [initialResponses]);

  const updateResponseList = (responseIds: string[]) => {
    setResponses((prev) => prev.filter((r) => !responseIds.includes(r.id)));
  };

  const updateResponse = (responseId: string, updatedResponse: TResponseWithQuotas) => {
    setResponses((prev) => prev.map((r) => (r.id === responseId ? updatedResponse : r)));
  };

  const surveyById = useMemo(() => {
    return new Map(surveys.map((s) => [s.id, s]));
  }, [surveys]);

  const timelineItems = useMemo(() => {
    const displayItems: TTimelineItem[] = displays.flatMap((d) => {
      const survey = surveyById.get(d.surveyId);
      return survey ? [{ type: "display" as const, data: d, survey }] : [];
    });

    const responseItems: TTimelineItem[] = responses.flatMap((r) => {
      const survey = surveyById.get(r.surveyId);
      return survey ? [{ type: "response" as const, data: r, survey }] : [];
    });

    const merged = [...displayItems, ...responseItems].sort((a, b) => {
      const aTime = new Date(a.data.createdAt).getTime();
      const bTime = new Date(b.data.createdAt).getTime();
      return bTime - aTime;
    });

    return isReversed ? [...merged].reverse() : merged;
  }, [displays, responses, surveyById, isReversed]);

  const toggleSort = () => {
    setIsReversed((prev) => !prev);
  };

  return (
    <div className="col-span-3">
      <div className="flex items-center justify-between pb-6">
        <h2 className="text-lg font-bold text-slate-700">{t("common.activity")}</h2>
        <div className="text-right">
          <button
            type="button"
            onClick={toggleSort}
            className="flex items-center px-1 text-slate-800 hover:text-brand-dark">
            <ArrowDownUpIcon className="inline size-4" />
          </button>
        </div>
      </div>
      {timelineItems.length === 0 ? (
        <EmptyState text={t("workspace.contacts.no_activity_yet")} />
      ) : (
        <div className="space-y-4">
          {timelineItems.map((item) =>
            item.type === "display" ? (
              <DisplayCard
                key={`display-${item.data.id}`}
                display={item.data}
                survey={item.survey}
                workspaceId={workspaceId}
                locale={locale}
              />
            ) : (
              <ResponseSurveyCard
                key={`response-${item.data.id}`}
                response={item.data}
                survey={item.survey}
                user={user}
                environmentTags={environmentTags}
                workspaceId={workspaceId}
                updateResponseList={updateResponseList}
                updateResponse={updateResponse}
                locale={locale}
                isReadOnly={isReadOnly}
              />
            )
          )}
        </div>
      )}
    </div>
  );
};
