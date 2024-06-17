import type { TLanguage } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { LanguageSelect } from "./language-select";

interface LanguageRowProps {
  language: TLanguage;
  isEditing: boolean;
  index: number;
  onLanguageChange: (newLanguage: TLanguage) => void;
  onDelete: () => void;
}

export function LanguageRow({ language, isEditing, onLanguageChange, onDelete }: LanguageRowProps) {
  return (
    <div className="my-3 grid grid-cols-4 gap-4">
      <LanguageSelect
        disabled={language.id !== "new"}
        language={language}
        onLanguageChange={onLanguageChange}
      />
      <Input disabled value={language.code} />
      <Input
        disabled={!isEditing}
        onChange={(e) => {
          onLanguageChange({ ...language, alias: e.target.value });
        }}
        placeholder="e.g. en_us"
        value={language.alias || ""}
      />
      {language.id !== "new" && isEditing ? (
        <Button className="w-fit" onClick={onDelete} size="sm" variant="warn">
          Remove
        </Button>
      ) : null}
    </div>
  );
}
