"use client";

import { useTranslation } from "react-i18next";
import { Checkbox } from "../checkbox";
import { Label } from "../label";

interface AdditionalIntegrationSettingsProps {
  includeVariables: boolean;
  includeHiddenFields: boolean;
  includeMetadata: boolean;
  includeCreatedAt: boolean;
  includeContactAttributes: boolean;
  setIncludeVariables: (includeVariables: boolean) => void;
  setIncludeHiddenFields: (includeHiddenFields: boolean) => void;
  setIncludeMetadata: (includeMetadata: boolean) => void;
  setIncludeCreatedAt: (includeCreatedAt: boolean) => void;
  setIncludeContactAttributes: (includeContactAttributes: boolean) => void;
}

export const AdditionalIntegrationSettings = ({
  includeVariables,
  includeHiddenFields,
  includeMetadata,
  includeCreatedAt,
  includeContactAttributes,
  setIncludeVariables,
  setIncludeHiddenFields,
  setIncludeMetadata,
  setIncludeCreatedAt,
  setIncludeContactAttributes,
}: AdditionalIntegrationSettingsProps) => {
  const { t } = useTranslation();

  const checkboxes = [
    {
      id: "includeCreatedAt",
      checked: includeCreatedAt,
      onChange: setIncludeCreatedAt,
      label: t("workspace.integrations.include_created_at"),
    },
    {
      id: "includeVariables",
      checked: includeVariables,
      onChange: setIncludeVariables,
      label: t("workspace.integrations.include_variables"),
    },
    {
      id: "includeHiddenFields",
      checked: includeHiddenFields,
      onChange: setIncludeHiddenFields,
      label: t("workspace.integrations.include_hidden_fields"),
    },
    {
      id: "includeMetadata",
      checked: includeMetadata,
      onChange: setIncludeMetadata,
      label: t("workspace.integrations.include_metadata"),
    },
    {
      id: "includeContactAttributes",
      checked: includeContactAttributes,
      onChange: setIncludeContactAttributes,
      label: t("workspace.integrations.include_contact_attributes"),
    },
  ];

  return (
    <div className="mt-4">
      <Label htmlFor="Surveys">{t("workspace.integrations.additional_settings")}</Label>
      <div className="text-sm">
        {checkboxes.map(({ id, checked, onChange, label }) => (
          <div key={id} className="my-1 flex items-center gap-x-2">
            <label htmlFor={id} className="flex cursor-pointer items-center">
              <Checkbox
                type="button"
                id={id}
                value={id}
                className="bg-white"
                checked={checked}
                onCheckedChange={() => onChange(!checked)}
              />
              <span className="ml-2 w-120 truncate">{label}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
