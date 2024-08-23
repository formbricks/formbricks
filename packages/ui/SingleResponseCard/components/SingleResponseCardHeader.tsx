import { LanguagesIcon, TrashIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";
import { getLanguageLabel } from "@formbricks/lib/i18n/utils";
import { getPersonIdentifier } from "@formbricks/lib/person/utils";
import { timeSince } from "@formbricks/lib/time";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { PersonAvatar } from "../../Avatars";
import { SurveyStatusIndicator } from "../../SurveyStatusIndicator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../Tooltip";
import { isSubmissionTimeMoreThan5Minutes } from "../util";

interface TooltipRendererProps {
  shouldRender: boolean;
  tooltipContent: ReactNode;
  children: ReactNode;
}

interface SingleResponseCardHeaderProps {
  pageType: "people" | "response";
  response: TResponse;
  survey: TSurvey;
  environment: TEnvironment;
  user?: TUser;
  isViewer: boolean;
  setDeleteDialogOpen: (deleteDialogOpen: boolean) => void;
}

export const SingleResponseCardHeader = ({
  pageType,
  response,
  survey,
  environment,
  user,
  isViewer,
  setDeleteDialogOpen,
}: SingleResponseCardHeaderProps) => {
  const displayIdentifier = response.person
    ? getPersonIdentifier(response.person, response.personAttributes)
    : null;
  const environmentId = survey.environmentId;
  const canResponseBeDeleted = response.finished
    ? true
    : isSubmissionTimeMoreThan5Minutes(response.updatedAt);
  const TooltipRenderer = (props: TooltipRendererProps) => {
    const { children, shouldRender, tooltipContent } = props;
    if (shouldRender) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger>{children}</TooltipTrigger>
            <TooltipContent avoidCollisions align="start">
              {tooltipContent}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return <>{children}</>;
  };

  const renderTooltip = Boolean(
    (response.personAttributes && Object.keys(response.personAttributes).length > 0) ||
      (response.meta.userAgent && Object.keys(response.meta.userAgent).length > 0)
  );

  const tooltipContent = (
    <>
      {response.singleUseId && (
        <div>
          <p className="py-1 font-bold text-slate-700">SingleUse ID:</p>
          <span>{response.singleUseId}</span>
        </div>
      )}
      {response.personAttributes && Object.keys(response.personAttributes).length > 0 && (
        <div>
          <p className="py-1 font-bold text-slate-700">Person attributes:</p>
          {Object.keys(response.personAttributes).map((key) => (
            <p key={key}>
              {key}:{" "}
              <span className="font-bold">{response.personAttributes && response.personAttributes[key]}</span>
            </p>
          ))}
        </div>
      )}

      {response.meta.userAgent && Object.keys(response.meta.userAgent).length > 0 && (
        <div className="text-slate-600">
          {response.personAttributes && Object.keys(response.personAttributes).length > 0 && (
            <hr className="my-2 border-slate-200" />
          )}
          <p className="py-1 font-bold text-slate-700">Device info:</p>
          {response.meta.userAgent?.browser && <p>Browser: {response.meta.userAgent.browser}</p>}
          {response.meta.userAgent?.os && <p>OS: {response.meta.userAgent.os}</p>}
          {response.meta.userAgent && (
            <p>
              Device:{" "}
              {response.meta.userAgent.device ? response.meta.userAgent.device : "PC / Generic device"}
            </p>
          )}
          {response.meta.url && <p>URL: {response.meta.url}</p>}
          {response.meta.action && <p>Action: {response.meta.action}</p>}
          {response.meta.source && <p>Source: {response.meta.source}</p>}
          {response.meta.country && <p>Country: {response.meta.country}</p>}
        </div>
      )}
    </>
  );
  const deleteSubmissionToolTip = <>This response is in progress.</>;

  return (
    <div className="space-y-2 border-b border-slate-200 px-6 pb-4 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-center space-x-4">
          {pageType === "response" && (
            <TooltipRenderer shouldRender={renderTooltip} tooltipContent={tooltipContent}>
              <div className="group">
                {response.person?.id ? (
                  user ? (
                    <Link
                      className="flex items-center"
                      href={`/environments/${environmentId}/people/${response.person.id}`}>
                      <PersonAvatar personId={response.person.id} />
                      <h3 className="ph-no-capture ml-4 pb-1 font-semibold text-slate-600 hover:underline">
                        {displayIdentifier}
                      </h3>
                    </Link>
                  ) : (
                    <div className="flex items-center">
                      <PersonAvatar personId={response.person.id} />
                      <h3 className="ph-no-capture ml-4 pb-1 font-semibold text-slate-600">
                        {displayIdentifier}
                      </h3>
                    </div>
                  )
                ) : (
                  <div className="flex items-center">
                    <PersonAvatar personId="anonymous" />
                    <h3 className="ml-4 pb-1 font-semibold text-slate-600">Anonymous</h3>
                  </div>
                )}
              </div>
            </TooltipRenderer>
          )}

          {pageType === "people" && (
            <div className="flex items-center justify-center space-x-2 rounded-full bg-slate-100 p-1 px-2 text-sm text-slate-600">
              {(survey.type === "link" ||
                environment.appSetupCompleted ||
                environment.websiteSetupCompleted) && <SurveyStatusIndicator status={survey.status} />}
              <Link
                className="hover:underline"
                href={`/environments/${environmentId}/surveys/${survey.id}/summary`}>
                {survey.name}
              </Link>
            </div>
          )}
          {response.language && response.language !== "default" && (
            <div className="flex space-x-2 rounded-full bg-slate-700 px-2 py-1 text-xs text-white">
              <div>{getLanguageLabel(response.language)}</div>
              <LanguagesIcon className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4 text-sm">
          <time className="text-slate-500" dateTime={timeSince(response.createdAt.toISOString())}>
            {timeSince(response.createdAt.toISOString())}
          </time>
          {user && !isViewer && (
            <TooltipRenderer shouldRender={!canResponseBeDeleted} tooltipContent={deleteSubmissionToolTip}>
              <TrashIcon
                onClick={() => {
                  if (canResponseBeDeleted) {
                    setDeleteDialogOpen(true);
                  }
                }}
                className={`h-4 w-4 ${
                  canResponseBeDeleted
                    ? "cursor-pointer text-slate-500 hover:text-red-700"
                    : "cursor-not-allowed text-slate-400"
                } `}
              />
            </TooltipRenderer>
          )}
        </div>
      </div>
    </div>
  );
};
