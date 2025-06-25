"use client";

import { convertDateTimeStringShort } from "@/lib/time";
import { capitalizeFirstLetter } from "@/lib/utils/strings";
import { Label } from "@/modules/ui/components/label";
import { Webhook } from "@prisma/client";
import { TFnType, useTranslate } from "@tolgee/react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface ActivityTabProps {
  webhook: Webhook;
  surveys: TSurvey[];
}

const getSurveyNamesForWebhook = (webhook: Webhook, allSurveys: TSurvey[]): string[] => {
  if (webhook.surveyIds.length === 0) {
    return allSurveys.map((survey) => survey.name);
  } else {
    return webhook.surveyIds.map((surveyId) => {
      const survey = allSurveys.find((survey) => survey.id === surveyId);
      return survey ? survey.name : "";
    });
  }
};

const convertTriggerIdToName = (triggerId: string, t: TFnType): string => {
  switch (triggerId) {
    case "responseCreated":
      return t("environments.integrations.webhooks.response_created");
    case "responseUpdated":
      return t("environments.integrations.webhooks.response_updated");
    case "responseFinished":
      return t("environments.integrations.webhooks.response_finished");
    default:
      return triggerId;
  }
};

export const WebhookOverviewTab = ({ webhook, surveys }: ActivityTabProps) => {
  const { t } = useTranslate();
  return (
    <div className="grid grid-cols-3 pb-2">
      <div className="col-span-2 space-y-4 pr-6">
        <div>
          <Label className="text-slate-500">{t("common.name")}</Label>
          <p className="truncate text-sm text-slate-900">{webhook.name ? webhook.name : "-"}</p>
        </div>

        <div>
          <Label className="text-slate-500">
            {t("environments.integrations.webhooks.created_by_third_party")}
          </Label>
          <p className="text-sm text-slate-900">
            {webhook.source === "user" ? "No" : capitalizeFirstLetter(webhook.source)}
          </p>
        </div>

        <div>
          <Label className="text-slate-500">{t("common.url")}</Label>
          <p className="text-sm text-slate-900">{webhook.url}</p>
        </div>

        <div>
          <Label className="text-slate-500">{t("common.surveys")}</Label>

          {getSurveyNamesForWebhook(webhook, surveys).map((surveyName, index) => (
            <p key={index} className="text-sm text-slate-900">
              {surveyName}
            </p>
          ))}
        </div>
        <div>
          <Label className="text-slate-500">{t("environments.integrations.webhooks.triggers")}</Label>
          {webhook.triggers.map((triggerId) => (
            <p key={triggerId} className="text-sm text-slate-900">
              {convertTriggerIdToName(triggerId, t)}
            </p>
          ))}
        </div>
      </div>
      <div className="col-span-1 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
        <div>
          <Label className="text-xs font-normal text-slate-500">{t("common.created_at")}</Label>
          <p className="text-xs text-slate-700">
            {convertDateTimeStringShort(webhook.createdAt?.toString())}
          </p>
        </div>
        <div>
          <Label className="text-xs font-normal text-slate-500">{t("common.updated_at")}</Label>
          <p className="text-xs text-slate-700">
            {convertDateTimeStringShort(webhook.updatedAt?.toString())}
          </p>
        </div>
      </div>
    </div>
  );
};
