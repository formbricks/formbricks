"use client";

import { TrashIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { timeSince } from "@/lib/time";
import { getContactIdentifier } from "@/lib/utils/contact";
import { PersonAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { SurveyStatusIndicator } from "@/modules/ui/components/survey-status-indicator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { isSubmissionTimeMoreThan5Minutes } from "../util";

interface SingleResponseCardHeaderProps {
  pageType: "people" | "response";
  response: TResponse;
  survey: TSurvey;
  environment: TEnvironment;
  user?: TUser;
  isReadOnly: boolean;
  setDeleteDialogOpen: (deleteDialogOpen: boolean) => void;
  locale: TUserLocale;
}

export const SingleResponseCardHeader = ({
  pageType,
  response,
  survey,
  environment,
  user,
  isReadOnly,
  setDeleteDialogOpen,
  locale,
}: SingleResponseCardHeaderProps) => {
  const displayIdentifier = response.contact
    ? getContactIdentifier(response.contact, response.contactAttributes)
    : null;

  const { t } = useTranslation();
  const environmentId = survey.environmentId;
  const canResponseBeDeleted = response.finished
    ? true
    : isSubmissionTimeMoreThan5Minutes(response.updatedAt);

  const deleteSubmissionToolTip = <>{t("environments.surveys.responses.this_response_is_in_progress")}</>;

  return (
    <div className="space-y-2 border-b border-slate-200 px-6 pb-4 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-center space-x-2">
          {pageType === "response" && (
            <>
              {response.contact?.id ? (
                user ? (
                  <Link
                    className="flex items-center space-x-2"
                    href={`/environments/${environmentId}/contacts/${response.contact.id}`}>
                    <PersonAvatar personId={response.contact.id} />
                    <h3 className="ph-no-capture ml-4 pb-1 font-semibold text-slate-600 hover:underline">
                      {displayIdentifier}
                    </h3>
                  </Link>
                ) : (
                  <div className="flex items-center space-x-2">
                    <PersonAvatar personId={response.contact.id} />
                    <h3 className="ph-no-capture ml-4 pb-1 font-semibold text-slate-600">
                      {displayIdentifier}
                    </h3>
                  </div>
                )
              ) : (
                <div className="flex items-center">
                  <PersonAvatar personId="anonymous" />
                  <h3 className="ml-4 pb-1 font-semibold text-slate-600">{t("common.anonymous")}</h3>
                </div>
              )}
              {response.contact?.userId && <IdBadge id={response.contact.userId} />}
            </>
          )}

          {pageType === "people" && (
            <div className="flex items-center justify-center space-x-2 rounded-full bg-slate-100 p-1 px-2 text-sm text-slate-600">
              {(survey.type === "link" || environment.appSetupCompleted) && (
                <SurveyStatusIndicator status={survey.status} />
              )}
              <Link
                className="hover:underline"
                href={`/environments/${environmentId}/surveys/${survey.id}/summary`}>
                {survey.name}
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 text-sm">
          <time className="text-slate-500" dateTime={timeSince(response.createdAt.toISOString(), locale)}>
            {timeSince(response.createdAt.toISOString(), locale)}
          </time>
          {user &&
            !isReadOnly &&
            (canResponseBeDeleted ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteDialogOpen(true)}
                aria-label="Delete response">
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
                      aria-label="Cannot delete response in progress">
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{deleteSubmissionToolTip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
        </div>
      </div>
    </div>
  );
};
