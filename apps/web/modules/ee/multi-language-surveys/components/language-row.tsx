import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { useTranslations } from "next-intl";
import type { TLanguage } from "@formbricks/types/product";
import { TUserLocale } from "@formbricks/types/user";
import { LanguageSelect } from "./language-select";

interface LanguageRowProps {
  language: TLanguage;
  isEditing: boolean;
  index: number;
  onLanguageChange: (newLanguage: TLanguage) => void;
  onDelete: () => void;
  locale: TUserLocale;
}

export function LanguageRow({ language, isEditing, onLanguageChange, onDelete, locale }: LanguageRowProps) {
  const t = useTranslations();
  return (
    <div className="my-3 grid grid-cols-4 gap-4">
      <LanguageSelect
        disabled={language.id !== "new"}
        language={language}
        onLanguageChange={onLanguageChange}
        locale={locale}
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
          {t("common.remove")}
        </Button>
      ) : null}
    </div>
  );
}
