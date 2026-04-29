"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { TConnectorOptionId, getConnectorOptions } from "../utils";

interface ConnectorTypeSelectorProps {
  selectedType: TConnectorOptionId | null;
  onSelectType: (type: TConnectorOptionId) => void;
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

export function ConnectorTypeSelector({ selectedType, onSelectType }: Readonly<ConnectorTypeSelectorProps>) {
  const { t } = useTranslation();
  const connectorOptions = getConnectorOptions(t);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {connectorOptions.map((option) => (
          <button
            key={option.id}
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
        ))}
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
