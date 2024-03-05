import { CSSObjectWithLabel } from "react-select";

import { TLanguage } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Select } from "@formbricks/ui/Select";

const customSelectStyles = {
  control: (provided: CSSObjectWithLabel) => ({
    ...provided,
    backgroundColor: "white",
    width: "100%",
    height: "100%",
    borderRadius: "5px",
    borderColor: "#cbd5e1",
  }),
};

type LanguageRowProps = {
  language: TLanguage;
  languageOptions: { value: string; label: string }[];
  isEditing: boolean;
  index: number;
  onLanguageChange: (newLanguage: TLanguage) => void;
  onDelete: () => void;
};

export const LanguageRow: React.FC<LanguageRowProps> = ({
  language,
  languageOptions,
  isEditing,
  onLanguageChange,
  onDelete,
}) => (
  <div className="my-3 grid grid-cols-4 gap-4">
    <Select
      value={languageOptions.find((option) => option.value === language.code)}
      onChange={(selectedOption: { value: any }) =>
        onLanguageChange({ ...language, code: selectedOption?.value || "" })
      }
      options={languageOptions}
      isDisabled={language.id !== "new"}
      isSearchable={true}
      placeholder="Search..."
      styles={customSelectStyles}
    />
    <Input disabled value={language.code} />
    <Input
      disabled={!isEditing}
      value={language.alias || ""}
      placeholder="e.g. en_us"
      onChange={(e) => onLanguageChange({ ...language, alias: e.target.value })}
    />

    {language.id !== "new" && isEditing && (
      <Button variant="warn" onClick={onDelete} className="w-fit" size="sm">
        Remove
      </Button>
    )}
  </div>
);
