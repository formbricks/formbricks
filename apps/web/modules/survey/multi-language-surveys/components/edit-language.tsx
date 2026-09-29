"use client";

import { TFunction } from "i18next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Language } from "@formbricks/database/prisma-browser";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/canonical";
import { isSurveyRuntimeLanguage } from "@formbricks/i18n-utils/survey-runtime-languages";
import { getLanguageLabel, iso639Languages } from "@formbricks/i18n-utils/utils";
import { TUserLocale } from "@formbricks/types/user";
import type { TWorkspace } from "@formbricks/types/workspace";
import { isWorkspaceDefaultSurveyLanguage } from "@/lib/i18n/default-survey-language";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { updateWorkspaceAction } from "@/modules/workspaces/settings/actions";
import {
  createLanguageAction,
  deleteLanguageAction,
  getSurveysUsingGivenLanguageAction,
  updateLanguageAction,
} from "../lib/actions";
import { AddLanguageButton } from "./add-language-button";
import { LanguageLabels } from "./language-labels";
import { LanguageRow } from "./language-row";

interface EditLanguageProps {
  workspace: TWorkspace;
  locale: TUserLocale;
  isReadOnly: boolean;
}

const checkIfDuplicateExists = (arr: string[]) => {
  return new Set(arr).size !== arr.length;
};

const validateLanguages = (languages: Language[], t: TFunction) => {
  const languageCodes = languages.map((language) => language.code.toLowerCase().trim());
  const languageAliases = languages
    .filter((language) => language.alias)
    .map((language) => language.alias!.toLowerCase().trim());

  if (languageCodes.includes("")) {
    toast.error(t("workspace.languages.please_select_a_language"), { duration: 2000 });
    return false;
  }

  // Check for duplicates within the languageCodes and languageAliases
  if (checkIfDuplicateExists(languageAliases) || checkIfDuplicateExists(languageCodes)) {
    toast.error(t("workspace.languages.duplicate_language_or_language_id"), { duration: 4000 });
    return false;
  }

  // Check if any alias matches the identifier of any added languages
  if (languageCodes.some((code) => languageAliases.includes(code))) {
    toast.error(t("workspace.languages.conflict_between_identifier_and_alias"), {
      duration: 6000,
    });
    return false;
  }

  // Prevent choosing an alias that clashes with the ISO code of some other
  // language. Without this guard users could create ambiguous language entries
  // (e.g. alias "nl" pointing to a non-Dutch language) which later breaks the
  // dropdowns that rely on ISO identifiers.
  for (const alias of languageAliases) {
    if (iso639Languages.some((language) => language.code === alias && !languageCodes.includes(alias))) {
      toast.error(t("workspace.languages.conflict_between_selected_alias_and_another_language"), {
        duration: 6000,
      });
      return false;
    }
  }

  return true;
};

export function EditLanguage({ workspace, locale, isReadOnly }: EditLanguageProps) {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState<Language[]>(workspace.languages);
  const [isEditing, setIsEditing] = useState(false);
  // Which language new surveys are written in (ENG-2816). Edited with the rows and saved with them, so
  // "which of these is the default" is one decision in one place rather than a second live control.
  const [defaultLanguage, setDefaultLanguage] = useState(
    normalizeLanguageCode(workspace.config.defaultSurveyLanguage ?? "") ?? ""
  );
  // Rows the user removed in this edit. Held until save so every change in the form commits together
  // rather than a removal landing on its own while the default language beside it is still unsaved.
  const [deletedLanguageIds, setDeletedLanguageIds] = useState<string[]>([]);
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    text: "",
    languageId: "",
    isButtonDisabled: false,
  });

  useEffect(() => {
    setLanguages(workspace.languages);
  }, [workspace.languages]);

  useEffect(() => {
    setDefaultLanguage(normalizeLanguageCode(workspace.config.defaultSurveyLanguage ?? "") ?? "");
  }, [workspace.config.defaultSurveyLanguage]);

  /**
   * One option per language in the table, keyed by canonical tag so a legacy row (`de`) and its
   * canonical twin (`de-DE`) collapse into one. Selectable means the survey runtime has strings for it,
   * including a regional variant served by its language's bundle (`es-MX` renders the `es-ES` strings);
   * a language with no strings at all is listed with the reason rather than dropped, since silently
   * omitting a language the workspace has reads as a bug (ENG-2325).
   */
  const languageOptions = useMemo(() => {
    const optionsByCode = new Map<string, { code: string; label: string; isSelectable: boolean }>();

    for (const language of languages) {
      const code = normalizeLanguageCode(language.code) ?? language.code;
      if (!code || optionsByCode.has(code)) continue;

      optionsByCode.set(code, {
        code,
        label: getLanguageLabel(code, locale) ?? code,
        isSelectable: isSurveyRuntimeLanguage(code),
      });
    }

    return Array.from(optionsByCode.values()).sort(
      (left, right) =>
        Number(right.isSelectable) - Number(left.isSelectable) ||
        left.label.localeCompare(right.label, locale)
    );
  }, [languages, locale]);

  const router = useRouter();

  const handleAddLanguage = () => {
    const newLanguage = {
      id: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
      code: "",
      alias: "",
      workspaceId: workspace.id,
    };
    setLanguages((prev) => [...prev, newLanguage]);
    setIsEditing(true);
  };

  const handleDeleteLanguage = async (languageId: string) => {
    // The default survey language must keep pointing at a language the workspace has, so the row it names
    // cannot be removed. Compared against the picker's current value rather than the saved one: both are
    // fields of this form, so "pick a different default, then remove this language" resolves inside one
    // edit instead of failing against a saved value the message never mentions (ENG-2816).
    const languageToDelete = languages.find((workspaceLanguage) => workspaceLanguage.id === languageId);
    if (languageToDelete && isWorkspaceDefaultSurveyLanguage(languageToDelete.code, defaultLanguage)) {
      setConfirmationModal({
        isOpen: true,
        languageId,
        text: t("workspace.languages.cannot_remove_default_survey_language_warning"),
        isButtonDisabled: true,
      });
      return;
    }

    try {
      const surveysUsingLanguageResponse = await getSurveysUsingGivenLanguageAction({
        languageId,
      });

      if (surveysUsingLanguageResponse?.serverError) {
        toast.error(getFormattedErrorMessage(surveysUsingLanguageResponse));
      } else if (surveysUsingLanguageResponse?.data) {
        if (surveysUsingLanguageResponse.data.length > 0) {
          const surveyList = surveysUsingLanguageResponse.data
            .map((surveyName) => `• ${surveyName}`)
            .join("\n");
          setConfirmationModal({
            isOpen: true,
            languageId,
            text: `${t("workspace.languages.cannot_remove_language_warning")}:\n\n${surveyList}\n\n${t("workspace.languages.remove_language_from_surveys_to_remove_it_from_workspace")}`,
            isButtonDisabled: true,
          });
        } else {
          setConfirmationModal({
            isOpen: true,
            languageId,
            text: t("workspace.languages.delete_language_confirmation"),
            isButtonDisabled: false,
          });
        }
      } else {
        const errorMessage = getFormattedErrorMessage(surveysUsingLanguageResponse);
        toast.error(errorMessage);
      }
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  /**
   * Takes the row out of the form and remembers it for the save, rather than deleting it there and then.
   * Writing the removal immediately split one edit across two commit points: the default language beside
   * it is only written on save, so the server still saw the old default and refused the very removal the
   * confirmation had just asked the user to enable (ENG-2816). Staging it also puts the row back on
   * cancel, which is what the surrounding edit/save/cancel form already promises for every other field.
   */
  const stageLanguageRemoval = (languageId: string) => {
    setLanguages((prev) => prev.filter((lang) => lang.id !== languageId));
    setDeletedLanguageIds((prev) => (prev.includes(languageId) ? prev : [...prev, languageId]));
    setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancelChanges = async () => {
    setLanguages(workspace.languages);
    setDefaultLanguage(normalizeLanguageCode(workspace.config.defaultSurveyLanguage ?? "") ?? "");
    setDeletedLanguageIds([]);
    setIsEditing(false);
  };

  const handleSaveChanges = async () => {
    if (!validateLanguages(languages, t)) return;
    const results = await Promise.all(
      languages.map((lang) => {
        return lang.id === "new"
          ? createLanguageAction({
              workspaceId: workspace.id,
              languageInput: { code: lang.code, alias: lang.alias },
            })
          : updateLanguageAction({
              workspaceId: workspace.id,
              languageId: lang.id,
              languageInput: { alias: lang.alias },
            });
      })
    );
    const errorResult = results.find((result) => result?.serverError);
    if (errorResult) {
      toast.error(getFormattedErrorMessage(errorResult));
      return;
    }

    // Written after the rows, and only when it changed: the default has to name a language that already
    // exists, which a language added in this same edit does not until the writes above land.
    const storedDefaultLanguage = normalizeLanguageCode(workspace.config.defaultSurveyLanguage ?? "") ?? "";
    if (defaultLanguage !== storedDefaultLanguage) {
      const defaultLanguageResult = await updateWorkspaceAction({
        workspaceId: workspace.id,
        // Only the key being changed: the action merges it onto the stored config, so a stale
        // `channel`/`industry` from this page's render can never overwrite a newer value.
        data: { config: { defaultSurveyLanguage: defaultLanguage || null } },
      });

      if (!defaultLanguageResult?.data) {
        toast.error(getFormattedErrorMessage(defaultLanguageResult));
        return;
      }
    }

    // Deletions go last. The server checks a delete against the *stored* default, so removing the language
    // that used to be the default is only legal once the new default written above has landed.
    if (deletedLanguageIds.length > 0) {
      const deletionResults = await Promise.all(
        deletedLanguageIds.map((languageId) =>
          deleteLanguageAction({ languageId, workspaceId: workspace.id })
        )
      );
      const failedDeletion = deletionResults.find((result) => result?.serverError);
      if (failedDeletion) {
        toast.error(getFormattedErrorMessage(failedDeletion));
        // Re-read from the server: the rows that survived have to come back rather than stay hidden.
        setDeletedLanguageIds([]);
        router.refresh();
        return;
      }
    }

    toast.success(
      deletedLanguageIds.length > 0
        ? t("workspace.languages.language_deleted_successfully")
        : t("workspace.languages.languages_updated_successfully")
    );
    setDeletedLanguageIds([]);
    router.refresh();
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col gap-y-4">
      <div className="space-y-4">
        {languages.length > 0 ? (
          <>
            <LanguageLabels />
            {languages.map((language, index) => (
              <LanguageRow
                isEditing={isEditing}
                key={language.id}
                language={language}
                locale={locale}
                onDelete={() => handleDeleteLanguage(language.id)}
                onLanguageChange={(newLanguage: Language) => {
                  const updatedLanguages = [...languages];
                  updatedLanguages[index] = newLanguage;
                  setLanguages(updatedLanguages);
                }}
              />
            ))}
          </>
        ) : (
          <p className="text-sm text-slate-500 italic">{t("workspace.languages.no_language_found")}</p>
        )}

        <AddLanguageButton
          onClick={handleAddLanguage}
          isEditing={isEditing}
          languages={languages}
          workspace={workspace}
        />

        {languageOptions.length > 0 && (
          <div className="flex w-full max-w-sm flex-col gap-y-2 pt-2">
            <Label htmlFor="defaultSurveyLanguage">{t("workspace.languages.default_survey_language")}</Label>
            <Select
              disabled={!isEditing}
              onValueChange={setDefaultLanguage}
              value={defaultLanguage || undefined}>
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
              {t("workspace.languages.default_survey_language_description")}
            </p>
          </div>
        )}
      </div>
      <EditSaveButtons
        isEditing={isEditing}
        onCancel={handleCancelChanges}
        disabled={isReadOnly}
        onEdit={() => {
          setIsEditing(true);
        }}
        onSave={handleSaveChanges}
        t={t}
      />
      {isReadOnly && (
        <Alert variant="warning" className="mt-4" role="status">
          <AlertDescription>
            {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
          </AlertDescription>
        </Alert>
      )}
      <ConfirmationModal
        buttonText={t("workspace.languages.remove_language")}
        isButtonDisabled={confirmationModal.isButtonDisabled}
        onConfirm={() => stageLanguageRemoval(confirmationModal.languageId)}
        open={confirmationModal.isOpen}
        setOpen={() => {
          setConfirmationModal((prev) => ({ ...prev, isOpen: !prev.isOpen }));
        }}
        body={confirmationModal.text}
        title={t("workspace.languages.remove_language")}
      />
    </div>
  );
}

const EditSaveButtons: React.FC<{
  disabled: boolean;
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  t: TFunction;
}> = ({ isEditing, onEdit, onSave, onCancel, disabled, t }) =>
  isEditing ? (
    <div className="flex gap-4">
      <Button onClick={onSave} size="sm" disabled={disabled}>
        {t("common.save_changes")}
      </Button>
      <Button onClick={onCancel} size="sm" variant="ghost" disabled={disabled}>
        {t("common.cancel")}
      </Button>
    </div>
  ) : (
    <Button className="w-fit" onClick={onEdit} size="sm" disabled={disabled}>
      {t("workspace.languages.edit_languages")}
    </Button>
  );
