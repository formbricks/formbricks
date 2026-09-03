"use client";

import { useTranslation } from "react-i18next";
import { Language } from "@formbricks/database/prisma-browser";
import { TUserLocale } from "@formbricks/types/user";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { RadioGroupItem } from "@/modules/ui/components/radio-group";
import { LanguageSelect } from "./language-select";

interface LanguageRowProps {
  language: Language;
  isEditing: boolean;
  /** The canonical code this row would be stored as, or null while the row has no language picked yet. */
  defaultLanguageValue: string | null;
  /** False when the survey runtime has no strings for this language, so it cannot be the default. */
  canBeDefault: boolean;
  onLanguageChange: (newLanguage: Language) => void;
  onDelete: () => void;
  locale: TUserLocale;
}

export function LanguageRow({
  language,
  isEditing,
  defaultLanguageValue,
  canBeDefault,
  onLanguageChange,
  onDelete,
  locale,
}: Readonly<LanguageRowProps>) {
  const { t } = useTranslation();
  return (
    <div className="my-3 grid grid-cols-5 items-center gap-4">
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
      <DefaultLanguageCell
        canBeDefault={canBeDefault}
        isEditing={isEditing}
        unsupportedLabel={t("workspace.languages.default_survey_language_unsupported")}
        value={defaultLanguageValue}
      />
      {language.id !== "new" && isEditing ? (
        <Button className="w-fit" onClick={onDelete} size="sm" variant="destructive">
          {t("common.remove")}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The radio is only rendered once the row has a language: a new row's code is empty, and an empty value
 * is what the group uses to mean "no default", so an item carrying it would read as selected.
 */
function DefaultLanguageCell({
  value,
  canBeDefault,
  isEditing,
  unsupportedLabel,
}: Readonly<{
  value: string | null;
  canBeDefault: boolean;
  isEditing: boolean;
  unsupportedLabel: string;
}>) {
  if (!value) {
    return <div />;
  }

  if (!canBeDefault) {
    return <span className="text-xs text-slate-400">{unsupportedLabel}</span>;
  }

  return <RadioGroupItem aria-label={value} disabled={!isEditing} value={value} />;
}
