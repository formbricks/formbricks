import { TI18nString } from "@formbricks/types/surveys";
import { Input } from "@formbricks/ui/Input";

import { extractLanguageSymbols, isLabelValidForAllLanguages } from "../utils/i18n";
import LanguageIndicator from "./LanguageIndicator";

interface LocalizedInputProps {
  id: string;
  name: string;
  value: TI18nString;
  isInvalid: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  languages: string[][];
  maxLength?: number;
  defaultValue?: string;
}
const LocalizedInput = ({
  id,
  name,
  value,
  isInvalid,
  onChange,
  placeholder,
  selectedLanguage,
  setSelectedLanguage,
  onBlur,
  languages,
  maxLength,
  defaultValue,
}: LocalizedInputProps) => {
  const hasi18n = value._i18n_;
  const isInComplete =
    id === "subheader" ||
    id === "lowerLabel" ||
    id === "upperLabel" ||
    id === "buttonLabel" ||
    id === "placeholder" ||
    id === "backButtonLabel"
      ? value.en?.trim() !== "" &&
        isInvalid &&
        !isLabelValidForAllLanguages(value, extractLanguageSymbols(languages)) &&
        selectedLanguage === "en"
      : isInvalid &&
        !isLabelValidForAllLanguages(value, extractLanguageSymbols(languages)) &&
        selectedLanguage === "en";
  return (
    <div className="relative w-full">
      <Input
        id={id}
        isInvalid={isInvalid && isInComplete}
        name={name}
        value={value[selectedLanguage] ?? ""}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder ?? ""}
        maxLength={maxLength}
        defaultValue={defaultValue ?? ""}
      />
      {hasi18n && languages?.length > 1 && (
        <div>
          <LanguageIndicator
            selectedLanguage={selectedLanguage}
            languages={languages}
            setSelectedLanguage={setSelectedLanguage}
          />

          {selectedLanguage !== "en" && value.en && (
            <div className="mt-1 text-xs text-gray-500">
              <strong>Translate:</strong> {value.en}
            </div>
          )}
        </div>
      )}

      {isInComplete && <div className="mt-1 text-xs text-red-400">Contains Incomplete translations</div>}
    </div>
  );
};

export default LocalizedInput;
