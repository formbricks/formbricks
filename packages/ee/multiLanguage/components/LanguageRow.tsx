import { TLanguage } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";

import { LanguageSelect } from "./LanguageSelect";

interface LanguageRowProps {
  language: TLanguage;
  isEditing: boolean;
  index: number;
  onLanguageChange: (newLanguage: TLanguage) => void;
  onDelete: () => void;
}

export const LanguageRow = ({ language, isEditing, onLanguageChange, onDelete }: LanguageRowProps) => {
  return (
    <div className="my-3 grid grid-cols-4 gap-4">
      <LanguageSelect
        language={language}
        onLanguageChange={onLanguageChange}
        disabled={language.id !== "new"}
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
};
