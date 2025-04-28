"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { Language } from "@prisma/client";
import { TFnType, useTranslate } from "@tolgee/react";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { iso639Languages } from "@formbricks/i18n-utils/src/utils";
import type { TProject } from "@formbricks/types/project";
import { TUserLocale } from "@formbricks/types/user";
import {
  createLanguageAction,
  deleteLanguageAction,
  getSurveysUsingGivenLanguageAction,
  updateLanguageAction,
} from "../lib/actions";
import { LanguageLabels } from "./language-labels";
import { LanguageRow } from "./language-row";

interface EditLanguageProps {
  project: TProject;
  locale: TUserLocale;
  isReadOnly: boolean;
  isMultiLanguageAllowed: boolean;
  environmentId: string;
  isFormbricksCloud: boolean;
}

const checkIfDuplicateExists = (arr: string[]) => {
  return new Set(arr).size !== arr.length;
};

const validateLanguages = (languages: Language[], t: TFnType) => {
  const languageCodes = languages.map((language) => language.code.toLowerCase().trim());
  const languageAliases = languages
    .filter((language) => language.alias)
    .map((language) => language.alias!.toLowerCase().trim());

  if (languageCodes.includes("")) {
    toast.error(t("environments.project.languages.please_select_a_language"), { duration: 2000 });
    return false;
  }

  // Check for duplicates within the languageCodes and languageAliases
  if (checkIfDuplicateExists(languageAliases) || checkIfDuplicateExists(languageCodes)) {
    toast.error(t("environments.project.languages.duplicate_language_or_language_id"), { duration: 4000 });
    return false;
  }

  // Check if any alias matches the identifier of any added languages
  if (languageCodes.some((code) => languageAliases.includes(code))) {
    toast.error(t("environments.project.languages.conflict_between_identifier_and_alias"), {
      duration: 6000,
    });
    return false;
  }

  // Check if the chosen alias matches an ISO identifier of a language that hasn't been added
  for (const alias of languageAliases) {
    if (iso639Languages.some((language) => language.alpha2 === alias && !languageCodes.includes(alias))) {
      toast.error(t("environments.project.languages.conflict_between_selected_alias_and_another_language"), {
        duration: 6000,
      });
      return false;
    }
  }

  return true;
};

export function EditLanguage({
  project,
  locale,
  isReadOnly,
  isMultiLanguageAllowed,
  environmentId,
  isFormbricksCloud,
}: EditLanguageProps) {
  const { t } = useTranslate();
  const [languages, setLanguages] = useState<Language[]>(project.languages);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    text: "",
    languageId: "",
    isButtonDisabled: false,
  });

  useEffect(() => {
    setLanguages(project.languages);
  }, [project.languages]);

  const handleAddLanguage = () => {
    const newLanguage = {
      id: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
      code: "",
      alias: "",
      projectId: project.id,
    };
    setLanguages((prev) => [...prev, newLanguage]);
    setIsEditing(true);
  };

  const handleDeleteLanguage = async (languageId: string) => {
    try {
      const surveysUsingLanguageResponse = await getSurveysUsingGivenLanguageAction({
        languageId,
      });

      if (surveysUsingLanguageResponse?.data) {
        if (surveysUsingLanguageResponse.data.length > 0) {
          const surveyList = surveysUsingLanguageResponse.data
            .map((surveyName) => `• ${surveyName}`)
            .join("\n");
          setConfirmationModal({
            isOpen: true,
            languageId,
            text: `${t("environments.project.languages.cannot_remove_language_warning")}:\n\n${surveyList}\n\n${t("environments.project.languages.remove_language_from_surveys_to_remove_it_from_project")}`,
            isButtonDisabled: true,
          });
        } else {
          setConfirmationModal({
            isOpen: true,
            languageId,
            text: t("environments.project.languages.delete_language_confirmation"),
            isButtonDisabled: false,
          });
        }
      } else {
        const errorMessage = getFormattedErrorMessage(surveysUsingLanguageResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  const performLanguageDeletion = async (languageId: string) => {
    try {
      await deleteLanguageAction({ languageId, projectId: project.id });
      setLanguages((prev) => prev.filter((lang) => lang.id !== languageId));
      toast.success(t("environments.project.languages.language_deleted_successfully"));
      // Close the modal after deletion
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      toast.error(t("common.something_went_wrong_please_try_again"));
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleCancelChanges = async () => {
    setLanguages(project.languages);
    setIsEditing(false);
  };

  const buttons: [ModalButton, ModalButton] = [
    {
      text: isFormbricksCloud ? t("common.start_free_trial") : t("common.request_trial_license"),
      href: isFormbricksCloud
        ? `/environments/${environmentId}/settings/billing`
        : "https://formbricks.com/upgrade-self-hosting-license",
    },
    {
      text: t("common.learn_more"),
      href: isFormbricksCloud
        ? `/environments/${environmentId}/settings/billing`
        : "https://formbricks.com/learn-more-self-hosting-license",
    },
  ];

  const handleSaveChanges = async () => {
    if (!validateLanguages(languages, t)) return;
    await Promise.all(
      languages.map((lang) => {
        return lang.id === "new"
          ? createLanguageAction({
              projectId: project.id,
              languageInput: { code: lang.code, alias: lang.alias },
            })
          : updateLanguageAction({
              projectId: project.id,
              languageId: lang.id,
              languageInput: { code: lang.code, alias: lang.alias },
            });
      })
    );
    toast.success(t("environments.project.languages.languages_updated_successfully"));
    setIsEditing(false);
  };

  const AddLanguageButton: React.FC<{ onClick: () => void }> = ({ onClick }) =>
    isEditing && languages.length === project.languages.length ? (
      <Button onClick={onClick} size="sm" variant="secondary">
        <PlusIcon />
        {t("environments.project.languages.add_language")}
      </Button>
    ) : null;

  return (
    <>
      {isMultiLanguageAllowed ? (
        <div className="flex flex-col space-y-4">
          <div className="space-y-4">
            {languages.length > 0 ? (
              <>
                <LanguageLabels />
                {languages.map((language, index) => (
                  <LanguageRow
                    index={index}
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
              <p className="text-sm text-slate-500 italic">
                {t("environments.project.languages.no_language_found")}
              </p>
            )}
            <AddLanguageButton onClick={handleAddLanguage} />
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
            <Alert variant="warning" className="mt-4">
              <AlertDescription>
                {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
              </AlertDescription>
            </Alert>
          )}
          <ConfirmationModal
            buttonText={t("environments.project.languages.remove_language")}
            isButtonDisabled={confirmationModal.isButtonDisabled}
            onConfirm={() => performLanguageDeletion(confirmationModal.languageId)}
            open={confirmationModal.isOpen}
            setOpen={() => {
              setConfirmationModal((prev) => ({ ...prev, isOpen: !prev.isOpen }));
            }}
            text={confirmationModal.text}
            title={t("environments.project.languages.remove_language")}
          />
        </div>
      ) : (
        <UpgradePrompt
          title={t("environments.settings.general.use_multi_language_surveys_with_a_higher_plan")}
          description={t(
            "environments.settings.general.use_multi_language_surveys_with_a_higher_plan_description"
          )}
          buttons={buttons}
        />
      )}
    </>
  );
}

const EditSaveButtons: React.FC<{
  disabled: boolean;
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  t: TFnType;
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
      {t("environments.project.languages.edit_languages")}
    </Button>
  );
