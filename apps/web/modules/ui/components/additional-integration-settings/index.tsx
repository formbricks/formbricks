"use client";

import { useTranslate } from "@tolgee/react";
import { Checkbox } from "../checkbox";
import { Label } from "../label";

interface AdditionalIntegrationSettingsProps {
  includeVariables: boolean;
  includeHiddenFields: boolean;
  includeMetadata: boolean;
  includeCreatedAt: boolean;
  setIncludeVariables: (includeVariables: boolean) => void;
  setIncludeHiddenFields: (includeHiddenFields: boolean) => void;
  setIncludeMetadata: (includeMetadata: boolean) => void;
  setIncludeCreatedAt: (includeCreatedAt: boolean) => void;
}

export const AdditionalIntegrationSettings = ({
  includeVariables,
  includeHiddenFields,
  includeMetadata,
  includeCreatedAt,
  setIncludeVariables,
  setIncludeHiddenFields,
  setIncludeMetadata,
  setIncludeCreatedAt,
}: AdditionalIntegrationSettingsProps) => {
  const { t } = useTranslate();

  const checkboxes = [
    {
      id: "includeCreatedAt",
      checked: includeCreatedAt,
      onChange: setIncludeCreatedAt,
      label: t("environments.integrations.include_created_at"),
    },
    {
      id: "includeVariables",
      checked: includeVariables,
      onChange: setIncludeVariables,
      label: t("environments.integrations.include_variables"),
    },
    {
      id: "includeHiddenFields",
      checked: includeHiddenFields,
      onChange: setIncludeHiddenFields,
      label: t("environments.integrations.include_hidden_fields"),
    },
    {
      id: "includeMetadata",
      checked: includeMetadata,
      onChange: setIncludeMetadata,
      label: t("environments.integrations.include_metadata"),
    },
  ];

  return (
    <div className="mt-4">
      <Label htmlFor="Surveys">{t("environments.integrations.additional_settings")}</Label>
      <div className="text-sm">
        {checkboxes.map(({ id, checked, onChange, label }) => (
          <div key={id} className="my-1 flex items-center space-x-2">
            <label htmlFor={id} className="flex cursor-pointer items-center">
              <Checkbox
                type="button"
                id={id}
                value={id}
                className="bg-white"
                checked={checked}
                onCheckedChange={() => onChange(!checked)}
              />
              <span className="ml-2 w-[30rem] truncate">{label}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
