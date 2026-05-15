"use client";

import { MessageSquareTextIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TResponseWithQuotas } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { timeSince } from "@/lib/time";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { SingleResponseCard } from "@/modules/analysis/components/SingleResponseCard";
import { Button } from "@/modules/ui/components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface ResponseSurveyCardProps {
  response: TResponseWithQuotas;
  survey: TSurvey;
  user: TUser;
  environmentTags: TTag[];
  workspaceId: string;
  updateResponseList: (responseIds: string[]) => void;
  updateResponse: (responseId: string, response: TResponseWithQuotas) => void;
  locale: TUserLocale;
  isReadOnly: boolean;
}

export const ResponseSurveyCard = ({
  response,
  survey,
  user,
  environmentTags,
  workspaceId,
  updateResponseList,
  updateResponse,
  locale,
  isReadOnly,
}: Readonly<ResponseSurveyCardProps>) => {
  const { t } = useTranslation();
  const workspaceBasePath = `/workspaces/${workspaceId}`;

  const surveyWithReplacedRecall = useMemo(() => replaceHeadlineRecall(survey, "default"), [survey]);

  const showDeleteButton = !!user && !isReadOnly;

  return (
    <SingleResponseCard
      survey={surveyWithReplacedRecall}
      response={response}
      user={user}
      environmentTags={environmentTags}
      isReadOnly={isReadOnly}
      updateResponse={updateResponse}
      updateResponseList={updateResponseList}
      locale={locale}
      renderHeader={({ onDeleteClick, canResponseBeDeleted }) => (
        <div className="flex items-center justify-between p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
              <MessageSquareTextIcon className="h-4 w-4 text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{t("workspace.contacts.survey_response_created")}</p>
              <Link
                href={`${workspaceBasePath}/surveys/${survey.id}/summary`}
                className="block truncate text-sm font-medium text-slate-700 hover:underline">
                {survey.name}
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <time className="px-1" dateTime={response.createdAt.toString()}>
              {timeSince(response.createdAt.toString(), locale)}
            </time>
            {showDeleteButton &&
              (canResponseBeDeleted ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDeleteClick}
                  aria-label={t("workspace.surveys.responses.delete_response")}>
                  <TrashIcon className="h-4 w-4" />
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        className="text-slate-400"
                        aria-label={t("workspace.surveys.responses.delete_response")}>
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {t("workspace.surveys.responses.this_response_is_in_progress")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
          </div>
        </div>
      )}
    />
  );
};
