"use client";

import { useTranslation } from "react-i18next";
import { Language } from "@formbricks/database/prisma-browser";
import { TUserLocale } from "@formbricks/types/user";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { LanguageSelect } from "./language-select";

interface LanguageRowProps {
  language: Language;
  isEditing: boolean;
  isDefault: boolean;
  onLanguageChange: (newLanguage: Language) => void;
  onSetDefault: () => void;
  onDelete: () => void;
  locale: TUserLocale;
}

export function LanguageRow({
  language,
  isEditing,
  isDefault,
  onLanguageChange,
  onSetDefault,
  onDelete,
  locale,
}: LanguageRowProps) {
  const { t } = useTranslation();
  return (
    <div className="my-3 grid grid-cols-5 items-center gap-4">
      <div className="flex justify-center">
        <input
          type="radio"
          name="workspace-default-language"
          className="size-4 cursor-pointer accent-brand-dark disabled:cursor-not-allowed"
          aria-label={t("workspace.languages.set_as_default")}
          checked={isDefault}
          disabled={!isEditing || !language.code}
          onChange={onSetDefault}
        />
      </div>
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
        <Button className="w-fit" onClick={onDelete} size="sm" variant="destructive">
          {t("common.remove")}
        </Button>
      ) : null}
    </div>
  );
}
