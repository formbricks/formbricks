"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import { useRetentionExemptionSurveyOptions } from "../../hooks/use-retention-exemptions";
import { getRetentionErrorMessage } from "../../lib/error-message";
import { groupSurveyOptionsByWorkspace } from "../../lib/survey-picker-options";
import type { TRetentionExemptionSurveyOption } from "../../types";

const SEARCH_DEBOUNCE_MS = 250;

interface ExemptionSurveyPickerProps {
  organizationId: string;
  value: TRetentionExemptionSurveyOption | null;
  onChange: (survey: TRetentionExemptionSurveyOption) => void;
  isInvalid?: boolean;
  disabled?: boolean;
}

/** Any survey in the organisation, searched by name on the server as the user types. */
export const ExemptionSurveyPicker = ({
  organizationId,
  value,
  onChange,
  isInvalid,
  disabled,
}: Readonly<ExemptionSurveyPickerProps>) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const {
    data: surveys = [],
    isFetching,
    error,
  } = useRetentionExemptionSurveyOptions({ organizationId, search: debouncedSearch, enabled: true });

  const getEmptyMessage = () => {
    if (error) return getRetentionErrorMessage(error, t, t("common.something_went_wrong_please_try_again"));
    if (isFetching) return t("common.loading");
    return t("common.no_surveys_found");
  };

  return (
    <InputCombobox
      id="exemption-survey"
      // The trigger renders as div[role="combobox"], which <label htmlFor> can't name.
      aria-label={t("common.survey")}
      searchPlaceholder={t("workspace.settings.data_retention.search_surveys")}
      placeholder={t("common.select_survey")}
      groupedOptions={groupSurveyOptionsByWorkspace(surveys, value)}
      value={value?.id ?? null}
      onChangeValue={(id) => {
        const survey = [value, ...surveys].find((option) => option?.id === id);
        if (survey) onChange(survey);
      }}
      onSearchChange={setSearch}
      emptyDropdownText={getEmptyMessage()}
      showCheckIcon
      disabled={disabled}
      comboboxClasses={isInvalid ? "max-w-none border-red-500" : "max-w-none"}
    />
  );
};
