"use client";

import Link from "next/link";
import { Trans, useTranslation } from "react-i18next";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { TConnectorOptionId, getConnectorOptions } from "../utils";

interface ConnectorTypeSelectorProps {
  selectedType: TConnectorOptionId | null;
  onSelectType: (type: TConnectorOptionId) => void;
  workspaceId: string;
  surveyCount: number;
}

const getOptionClassName = (
  selectedType: TConnectorOptionId | null,
  optionId: TConnectorOptionId,
  disabled: boolean
): string => {
  if (selectedType === optionId) {
    return "border-brand-dark bg-slate-50";
  }

  if (disabled) {
    return "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60";
  }

  return "border-slate-200 hover:border-slate-300 hover:bg-slate-50";
};

export function ConnectorTypeSelector({
  selectedType,
  onSelectType,
  workspaceId,
  surveyCount,
}: Readonly<ConnectorTypeSelectorProps>) {
  const { t } = useTranslation();
  const connectorOptions = getConnectorOptions(t);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {connectorOptions.map((option) => {
          const showNoSurveysAlert =
            surveyCount === 0 && option.id === "formbricks_survey" && selectedType === "formbricks_survey";
          const showApiIngestionSetupAlert =
            option.id === "api_ingestion" && selectedType === "api_ingestion";
          return (
            <div key={option.id} className="space-y-2">
              <button
                type="button"
                disabled={option.disabled}
                onClick={() => onSelectType(option.id)}
                className={`flex w-full items-center justify-between rounded-lg border p-3.5 text-left text-sm transition-colors ${getOptionClassName(
                  selectedType,
                  option.id,
                  option.disabled
                )}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium leading-5 text-slate-900">{option.name}</span>
                    {option.badge && <Badge text={option.badge.text} type={option.badge.type} size="tiny" />}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{option.description}</p>
                </div>
                <div
                  className={`ml-3 h-4 w-4 rounded-full border-2 ${
                    selectedType === option.id ? "border-brand-dark bg-brand-dark" : "border-slate-300"
                  }`}>
                  {selectedType === option.id && (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </button>
              {showNoSurveysAlert && <NoFormbricksSurveysAlert workspaceId={workspaceId} />}
              {showApiIngestionSetupAlert && <ApiIngestionSetupAlert />}
            </div>
          );
        })}
      </div>
      <Alert variant="outbound" size="small">
        <AlertTitle>{t("workspace.unify.missing_feedback_source_title")}</AlertTitle>
        <AlertButton asChild>
          <Link
            href="https://app.formbricks.com/s/cmob8tub9s2ndu5010ei4it0g"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-900 hover:underline">
            {t("workspace.unify.request_feedback_source")}
          </Link>
        </AlertButton>
      </Alert>
    </div>
  );
}

const ApiIngestionSetupAlert = () => {
  const { t } = useTranslation();

  return (
    <Alert variant="info" size="small">
      <div className="min-w-0 space-y-1">
        <AlertTitle>{t("workspace.unify.api_ingestion_setup_title")}</AlertTitle>
        <AlertDescription className="overflow-visible whitespace-normal">
          <p>{t("workspace.unify.api_ingestion_setup_description")}</p>
        </AlertDescription>
      </div>
    </Alert>
  );
};

const NoFormbricksSurveysAlert = ({ workspaceId }: Readonly<{ workspaceId: string }>) => {
  return (
    <Alert variant="info" size="small">
      <AlertDescription className="overflow-visible whitespace-normal">
        <Trans
          i18nKey="workspace.unify.no_formbricks_surveys_available_description"
          components={{
            surveyLink: (
              <Link href={`/workspaces/${workspaceId}/surveys/templates`} className="font-medium underline" />
            ),
          }}
        />
      </AlertDescription>
    </Alert>
  );
};
