"use client";

import { Webhook } from "@prisma/client";
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { timeSince } from "@/lib/time";
import { Badge } from "@/modules/ui/components/badge";

const renderSelectedSurveysText = (webhook: Webhook, allSurveys: TSurvey[]) => {
  let surveyNames: string[];

  if (webhook.surveyIds.length === 0) {
    surveyNames = allSurveys.map((survey) => survey.name);
  } else {
    surveyNames = webhook.surveyIds
      .map((surveyId) => {
        const survey = allSurveys.find((s) => s.id === surveyId);
        return survey ? survey.name : "";
      })
      .filter(Boolean);
  }

  if (surveyNames.length === 0) {
    return <p className="text-slate-400">-</p>;
  }

  return (
    <p className="truncate text-slate-400" title={surveyNames.join(", ")}>
      {surveyNames.join(", ")}
    </p>
  );
};

const renderSelectedTriggersText = (webhook: Webhook, t: TFunction) => {
  if (webhook.triggers.length === 0) {
    return <p className="text-slate-400">{t("environments.integrations.webhooks.no_triggers")}</p>;
  } else {
    let cleanedTriggers = webhook.triggers.map((trigger) => {
      if (trigger === "responseCreated") {
        return t("environments.integrations.webhooks.response_created");
      } else if (trigger === "responseUpdated") {
        return t("environments.integrations.webhooks.response_updated");
      } else if (trigger === "responseFinished") {
        return t("environments.integrations.webhooks.response_finished");
      } else {
        return trigger;
      }
    });

    return (
      <p className="text-slate-400">
        {cleanedTriggers
          .sort((a, b) => {
            const triggerOrder = {
              "Response Created": 1,
              "Response Updated": 2,
              "Response Finished": 3,
            };

            return (triggerOrder as Record<string, number>)[a] - (triggerOrder as Record<string, number>)[b];
          })
          .join(", ")}
      </p>
    );
  }
};

export const WebhookRowData = ({ webhook, surveys }: { webhook: Webhook; surveys: TSurvey[] }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";

  return (
    <div className="mt-2 grid h-auto grid-cols-12 content-center rounded-lg py-2 hover:bg-slate-100">
      <div className="col-span-3 flex items-center truncate pl-6 text-sm">
        <div className="flex items-center">
          <div className="text-left">
            {webhook.name ? (
              <div className="text-left">
                <div className="font-medium text-slate-900">{webhook.name}</div>
                <div className="text-xs text-slate-400">{webhook.url}</div>
              </div>
            ) : (
              <div className="font-medium text-slate-900">{webhook.url}</div>
            )}
          </div>
        </div>
      </div>
      <div className="col-span-1 my-auto text-center text-sm text-slate-800">
        <Badge type="gray" size="tiny" text={webhook.source || t("common.user")} className="capitalize" />
      </div>
      <div className="col-span-4 my-auto text-center text-sm text-slate-800">
        {renderSelectedSurveysText(webhook, surveys)}
      </div>
      <div className="col-span-2 my-auto text-center text-sm text-slate-800">
        {renderSelectedTriggersText(webhook, t)}
      </div>
      <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
        {timeSince(webhook.updatedAt.toString(), locale)}
      </div>
      <div className="text-center"></div>
    </div>
  );
};
