"use client";

import { ArrowDownUpIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TDisplay } from "@formbricks/types/displays";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { useMembershipRole } from "@/lib/membership/hooks/useMembershipRole";
import { getAccessFlags } from "@/lib/membership/utils";
import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { DisplayCard } from "./display-card";
import { ResponseSurveyCard } from "./response-survey-card";

type TTimelineItem =
  | { type: "display"; data: Pick<TDisplay, "id" | "createdAt" | "surveyId"> }
  | { type: "response"; data: TResponseWithQuotas };

interface ActivityTimelineProps {
  surveys: TSurvey[];
  user: TUser;
  responses: TResponseWithQuotas[];
  displays: Pick<TDisplay, "id" | "createdAt" | "surveyId">[];
  environment: TEnvironment;
  environmentTags: TTag[];
  locale: TUserLocale;
  projectPermission: TTeamPermission | null;
}

export const ActivityTimeline = ({
  surveys,
  user,
  responses: initialResponses,
  displays,
  environment,
  environmentTags,
  locale,
  projectPermission,
}: ActivityTimelineProps) => {
  const { t } = useTranslation();
  const [responses, setResponses] = useState(initialResponses);
  const [isReversed, setIsReversed] = useState(false);

  const { membershipRole } = useMembershipRole(environment.id, user.id);

  const isReadOnly = useMemo(() => {
    const { isMember } = getAccessFlags(membershipRole);
    const { hasReadAccess } = getTeamPermissionFlags(projectPermission);
    return isMember && hasReadAccess;
  }, [membershipRole, projectPermission]);

  useEffect(() => {
    setResponses(initialResponses);
  }, [initialResponses]);

  const updateResponseList = (responseIds: string[]) => {
    setResponses((prev) => prev.filter((r) => !responseIds.includes(r.id)));
  };

  const updateResponse = (responseId: string, updatedResponse: TResponseWithQuotas) => {
    setResponses((prev) => prev.map((r) => (r.id === responseId ? updatedResponse : r)));
  };

  const timelineItems = useMemo(() => {
    const displayItems: TTimelineItem[] = displays.map((d) => ({
      type: "display" as const,
      data: d,
    }));

    const responseItems: TTimelineItem[] = responses.map((r) => ({
      type: "response" as const,
      data: r,
    }));

    const merged = [...displayItems, ...responseItems].sort((a, b) => {
      const aTime = new Date(a.data.createdAt).getTime();
      const bTime = new Date(b.data.createdAt).getTime();
      return bTime - aTime;
    });

    return isReversed ? [...merged].reverse() : merged;
  }, [displays, responses, isReversed]);

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
            className="hover:text-brand-dark flex items-center px-1 text-slate-800">
            <ArrowDownUpIcon className="inline h-4 w-4" />
          </button>
        </div>
      </div>
      {timelineItems.length === 0 ? (
        <EmptyState text={t("environments.contacts.no_activity_yet")} />
      ) : (
        <div className="space-y-4">
          {timelineItems.map((item) =>
            item.type === "display" ? (
              <DisplayCard
                key={`display-${item.data.id}`}
                display={item.data}
                surveys={surveys}
                environmentId={environment.id}
                locale={locale}
              />
            ) : (
              <ResponseSurveyCard
                key={`response-${item.data.id}`}
                response={item.data}
                surveys={surveys}
                user={user}
                environmentTags={environmentTags}
                environment={environment}
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
