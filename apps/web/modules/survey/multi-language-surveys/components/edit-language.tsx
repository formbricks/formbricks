"use client";

import { TFunction } from "i18next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Language } from "@formbricks/database/prisma-browser";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import { isSurveyRuntimeLanguage } from "@formbricks/i18n-utils/src/survey-runtime-languages";
import { iso639Languages } from "@formbricks/i18n-utils/src/utils";
import { TUserLocale } from "@formbricks/types/user";
import type { TWorkspace } from "@formbricks/types/workspace";
import { isWorkspaceDefaultSurveyLanguage } from "@/lib/i18n/default-survey-language";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { RadioGroup } from "@/modules/ui/components/radio-group";
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
    // The workspace default survey language must keep pointing at a language the workspace has, so the
    // row it names cannot be removed until a different default is picked (ENG-2816).
    const languageToDelete = languages.find((workspaceLanguage) => workspaceLanguage.id === languageId);
    if (
      languageToDelete &&
      isWorkspaceDefaultSurveyLanguage(languageToDelete.code, workspace.config.defaultSurveyLanguage)
    ) {
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

  const performLanguageDeletion = async (languageId: string) => {
    try {
      const result = await deleteLanguageAction({ languageId, workspaceId: workspace.id });
      if (result?.serverError) {
        toast.error(getFormattedErrorMessage(result));
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
        return;
      }
      setLanguages((prev) => prev.filter((lang) => lang.id !== languageId));
      toast.success(t("workspace.languages.language_deleted_successfully"));
      // Close the modal after deletion
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleCancelChanges = async () => {
    setLanguages(workspace.languages);
    setDefaultLanguage(normalizeLanguageCode(workspace.config.defaultSurveyLanguage ?? "") ?? "");
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
        data: {
          // `config` is a JSON column replaced wholesale, so its other keys have to be carried over.
          config: { ...workspace.config, defaultSurveyLanguage: defaultLanguage || null },
        },
      });

      if (!defaultLanguageResult?.data) {
        toast.error(getFormattedErrorMessage(defaultLanguageResult));
        return;
      }
    }

    toast.success(t("workspace.languages.languages_updated_successfully"));
    router.refresh();
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col gap-y-4">
      <div className="space-y-4">
        {languages.length > 0 ? (
          <>
            <LanguageLabels />
            <RadioGroup onValueChange={setDefaultLanguage} value={defaultLanguage}>
              {languages.map((language, index) => {
                const canonicalCode = normalizeLanguageCode(language.code) ?? language.code;
                return (
                  <LanguageRow
                    canBeDefault={isSurveyRuntimeLanguage(canonicalCode)}
                    defaultLanguageValue={canonicalCode || null}
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
                );
              })}
            </RadioGroup>
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
        onConfirm={() => performLanguageDeletion(confirmationModal.languageId)}
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
