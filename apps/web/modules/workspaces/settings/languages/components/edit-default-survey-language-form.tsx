"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import { isSurveyRuntimeLanguage } from "@formbricks/i18n-utils/src/survey-runtime-languages";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import type { TUserLocale } from "@formbricks/types/user";
import type { TWorkspace } from "@formbricks/types/workspace";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { updateWorkspaceAction } from "@/modules/workspaces/settings/actions";

interface EditDefaultSurveyLanguageFormProps {
  workspace: TWorkspace;
  locale: TUserLocale;
  isReadOnly: boolean;
}

export const EditDefaultSurveyLanguageForm = ({
  workspace,
  locale,
  isReadOnly,
}: Readonly<EditDefaultSurveyLanguageFormProps>) => {
  const { t } = useTranslation();
  const router = useRouter();

  /**
   * The workspace's own languages, keyed by canonical tag so a legacy row (`de`) and its canonical twin
   * (`de-DE`) collapse into one option. Offering a language the workspace does not have would let the
   * setting name one nothing else in the workspace knows about.
   *
   * Selectable means the survey runtime has strings for it, including a regional variant served by its
   * language's bundle (`es-MX` renders the `es-ES` strings). A language with no strings at all is listed
   * but disabled rather than dropped: as the default it would wrap translated questions in English
   * buttons and validation errors (ENG-2325), and silently omitting a language the workspace *does*
   * have reads as a bug. Selectable ones sort first.
   */
  const languageOptions = useMemo(() => {
    const optionsByCode = new Map<string, { code: string; label: string; isSelectable: boolean }>();

    for (const language of workspace.languages) {
      const code = normalizeLanguageCode(language.code) ?? language.code;

      if (!optionsByCode.has(code)) {
        optionsByCode.set(code, {
          code,
          label: getLanguageLabel(code, locale) ?? code,
          isSelectable: isSurveyRuntimeLanguage(code),
        });
      }
    }

    return Array.from(optionsByCode.values()).sort(
      (left, right) =>
        Number(right.isSelectable) - Number(left.isSelectable) ||
        left.label.localeCompare(right.label, locale)
    );
  }, [workspace.languages, locale]);

  /**
   * Unset is a placeholder, not an option: until a language is picked, new surveys keep falling back to
   * the creator's own language. Offering that fallback as a choice would let the setting produce a
   * survey in a language this list does not even contain.
   *
   * Resolved rather than read raw, so a stored value that is not selectable any more reads as unset —
   * which is how it behaves — instead of as a selection that quietly does nothing.
   */
  const storedCode = normalizeLanguageCode(workspace.config.defaultSurveyLanguage ?? "");
  const storedValue = languageOptions.some((option) => option.isSelectable && option.code === storedCode)
    ? (storedCode ?? undefined)
    : undefined;

  /**
   * The stored value is the source of truth; state only holds the pick while the write is in flight.
   * Holding the selection itself in state would strand it: `router.refresh()` re-renders this component
   * without remounting it, so a language list that shrinks under it (the sibling editor deletes a row)
   * would leave a value behind with no matching option.
   */
  const [pendingValue, setPendingValue] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const selectedValue = pendingValue ?? storedValue;

  // Drop the optimistic value once the refreshed props carry it, so the prop is in charge again.
  useEffect(() => {
    setPendingValue((pending) => (pending === storedValue ? undefined : pending));
  }, [storedValue]);

  // Saved on pick: one control, one decision, no separate submit. A failed write drops the optimistic
  // value, so the control never shows a default the workspace does not have.
  const handleChange = async (nextValue: string) => {
    setPendingValue(nextValue);
    setIsSaving(true);

    try {
      // `config` is a JSON column replaced wholesale, so its other keys have to be carried over.
      const response = await updateWorkspaceAction({
        workspaceId: workspace.id,
        data: { config: { ...workspace.config, defaultSurveyLanguage: nextValue } },
      });

      if (!response?.data) {
        setPendingValue(undefined);
        toast.error(getFormattedErrorMessage(response));
        return;
      }

      toast.success(t("workspace.languages.default_survey_language_updated_successfully"));
      router.refresh();
    } catch {
      // A rejected call — dropped connection, 500 from the action endpoint — must not leave the
      // control disabled with nothing said.
      setPendingValue(undefined);
      toast.error(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsSaving(false);
    }
  };

  // No languages at all: no control, so the card ends cleanly at the language list. Languages that
  // exist but cannot be the default still render — disabled, with the reason — so the setting never
  // silently disappears.
  if (languageOptions.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-y-2">
      <Label htmlFor="defaultSurveyLanguage">{t("workspace.languages.default_survey_language")}</Label>
      <Select
        value={selectedValue}
        onValueChange={(nextValue) => void handleChange(nextValue)}
        disabled={isReadOnly || isSaving}>
        <SelectTrigger id="defaultSurveyLanguage" className="bg-white">
          <SelectValue placeholder={t("workspace.languages.default_survey_language_placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {languageOptions.map(({ code, label, isSelectable }) => (
            <SelectItem key={code} value={code} disabled={!isSelectable}>
              {label}
              {!isSelectable && (
                <span className="ml-2 text-xs text-slate-400">
                  {t("workspace.languages.default_survey_language_unsupported")}
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-slate-500">
        {selectedValue
          ? t("workspace.languages.default_survey_language_description")
          : t("workspace.languages.default_survey_language_unset_description")}
      </p>
    </div>
  );
};
