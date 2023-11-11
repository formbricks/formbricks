import { Input } from "@formbricks/ui/Input";
import LanguageIndicator from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/LanguageIndicator";
import { TI18nString } from "@formbricks/types/i18n";

interface LocalizedInputProps {
  id: string;
  name: string;
  value: TI18nString;
  isInValid: boolean;
  onChange;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  onBlur?;
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
  return (
    <div className="relative w-full">
      <Input
        id={id}
        isInvalid={isInValid && value[selectedLanguage].trim() === ""}
        name={name}
        value={value[selectedLanguage]}
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
    </div>
  );
};

export default LocalizedInput;
