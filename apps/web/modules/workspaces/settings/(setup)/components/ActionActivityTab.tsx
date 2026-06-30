"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TActionClass } from "@formbricks/types/action-classes";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { ErrorComponent } from "@/modules/ui/components/error-component";
import { Label } from "@/modules/ui/components/label";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { getActiveInactiveSurveysAction } from "@/modules/workspaces/settings/(setup)/app-connection/actions";
import { ACTION_TYPE_ICON_LOOKUP } from "@/modules/workspaces/settings/(setup)/app-connection/utils";

interface ActivityTabProps {
  actionClass: TActionClass;
}

export const ActionActivityTab = ({ actionClass }: ActivityTabProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const [activeSurveys, setActiveSurveys] = useState<string[] | undefined>();
  const [inactiveSurveys, setInactiveSurveys] = useState<string[] | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    setLoading(true);

    const updateState = async () => {
      setLoading(true);
      const getActiveInactiveSurveysResponse = await getActiveInactiveSurveysAction({
        actionClassId: actionClass.id,
      });
      if (getActiveInactiveSurveysResponse?.data) {
        setActiveSurveys(getActiveInactiveSurveysResponse.data.activeSurveys);
        setInactiveSurveys(getActiveInactiveSurveysResponse.data.inactiveSurveys);
      } else {
        const errorMessage = getFormattedErrorMessage(getActiveInactiveSurveysResponse);
        setError(new Error(errorMessage));
      }
      setLoading(false);
    };

    updateState();
  }, [actionClass.id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorComponent />;

  return (
    <div className="grid grid-cols-3 pb-2">
      <div className="col-span-2 space-y-4 pr-6">
        <div>
          <Label className="text-slate-500">{t("common.active_surveys")}</Label>
          {activeSurveys?.length === 0 && <p className="text-sm text-slate-900">-</p>}
          {activeSurveys?.map((surveyName) => (
            <p key={surveyName} className="text-sm text-slate-900">
              {surveyName}
            </p>
          ))}
        </div>
        <div>
          <Label className="text-slate-500">{t("common.inactive_surveys")}</Label>
          {inactiveSurveys?.length === 0 && <p className="text-sm text-slate-900">-</p>}
          {inactiveSurveys?.map((surveyName) => (
            <p key={surveyName} className="text-sm text-slate-900">
              {surveyName}
            </p>
          ))}
        </div>
      </div>
      <div className="col-span-1 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
        <div>
          <Label className="text-xs font-normal text-slate-500">{t("common.created_at")}</Label>
          <p className="text-xs text-slate-700">{formatDateTimeForDisplay(actionClass.createdAt, locale)}</p>
        </div>{" "}
        <div>
          <Label className="text-xs font-normal text-slate-500">{t("common.updated_at")}</Label>
          <p className="text-xs text-slate-700">{formatDateTimeForDisplay(actionClass.updatedAt, locale)}</p>
        </div>
        <div>
          <Label className="block text-xs font-normal text-slate-500">{t("common.type")}</Label>
          <div className="mt-1 flex items-center">
            <div className="mr-1.5 size-4 text-slate-600">{ACTION_TYPE_ICON_LOOKUP[actionClass.type]}</div>
            <p className="text-sm capitalize text-slate-700">{actionClass.type}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
