"use client";

import { ArrowDownUpIcon, EyeIcon } from "lucide-react";
import Link from "next/link";
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
import { timeSince } from "@/lib/time";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";
import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { EmptyState } from "@/modules/ui/components/empty-state";

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
                projectPermission={projectPermission}
              />
            )
          )}
        </div>
      )}
    </div>
  );
};

const DisplayCard = ({
  display,
  surveys,
  environmentId,
  locale,
}: {
  display: Pick<TDisplay, "id" | "createdAt" | "surveyId">;
  surveys: TSurvey[];
  environmentId: string;
  locale: TUserLocale;
}) => {
  const { t } = useTranslation();
  const survey = surveys.find((s) => s.id === display.surveyId);

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
          <EyeIcon className="h-4 w-4 text-slate-600" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{t("environments.contacts.survey_viewed")}</p>
          {survey ? (
            <Link
              href={`/environments/${environmentId}/surveys/${survey.id}/summary`}
              className="text-sm font-medium text-slate-700 hover:underline">
              {survey.name}
            </Link>
          ) : (
            <span className="text-sm font-medium text-slate-500">{t("common.unknown_survey")}</span>
          )}
        </div>
      </div>
      <span className="text-sm text-slate-500">{timeSince(display.createdAt.toISOString(), locale)}</span>
    </div>
  );
};

const ResponseSurveyCard = ({
  response,
  surveys,
  user,
  environmentTags,
  environment,
  updateResponseList,
  updateResponse,
  locale,
  projectPermission,
}: {
  response: TResponseWithQuotas;
  surveys: TSurvey[];
  user: TUser;
  environmentTags: TTag[];
  environment: TEnvironment;
  updateResponseList: (responseIds: string[]) => void;
  updateResponse: (responseId: string, response: TResponseWithQuotas) => void;
  locale: TUserLocale;
  projectPermission: TTeamPermission | null;
}) => {
  const survey = surveys.find((s) => s.id === response.surveyId);
  const { membershipRole } = useMembershipRole(survey?.environmentId || "", user.id);
  const { isMember } = getAccessFlags(membershipRole);
  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);
  const isReadOnly = isMember && hasReadAccess;

  if (!survey) return null;

  return (
    <SingleResponseCard
      response={response}
      survey={replaceHeadlineRecall(survey, "default")}
      user={user}
      environmentTags={environmentTags}
      environment={environment}
      updateResponseList={updateResponseList}
      updateResponse={updateResponse}
      isReadOnly={isReadOnly}
      locale={locale}
    />
  );
};
