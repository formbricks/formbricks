import { TI18nString } from "@formbricks/types/surveys";
import { Input } from "@formbricks/ui/Input";

import { extractLanguageSymbols, isLabelValidForAllLanguages } from "../utils/i18n";
import LanguageIndicator from "./LanguageIndicator";

interface LocalizedInputProps {
  id: string;
  name: string;
  value: TI18nString;
  isInValid: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  languages: string[][];
}
const LocalizedInput = ({
  id,
  name,
  value,
  isInValid,
  onChange,
  selectedLanguage,
  setSelectedLanguage,
  onBlur,
  languages,
}: LocalizedInputProps) => {
  const hasi18n = value._i18n_;
  const isInComplete =
    id === "subheader"
      ? value.en.trim() !== "" &&
        isInValid &&
        !isLabelValidForAllLanguages(value, extractLanguageSymbols(languages)) &&
        selectedLanguage === "en"
      : isInValid &&
        !isLabelValidForAllLanguages(value, extractLanguageSymbols(languages)) &&
        selectedLanguage === "en";
  return (
    <div className="relative w-full">
      <Input
        id={id}
        isInvalid={isInValid && isInComplete}
        name={name}
        value={value[selectedLanguage] ? value[selectedLanguage] : ""}
        onChange={onChange}
        onBlur={onBlur}
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
