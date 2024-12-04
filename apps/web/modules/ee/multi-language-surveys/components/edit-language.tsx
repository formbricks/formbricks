"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { iso639Languages } from "@formbricks/lib/i18n/utils";
import type { TLanguage, TProject } from "@formbricks/types/project";
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
}

const checkIfDuplicateExists = (arr: string[]) => {
  return new Set(arr).size !== arr.length;
};

const validateLanguages = (languages: TLanguage[], t: (key: string) => string) => {
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

  // Check if the chosen alias matches an ISO identifier of a language that hasn’t been added
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

export function EditLanguage({ project, locale, isReadOnly }: EditLanguageProps) {
  const t = useTranslations();
  const [languages, setLanguages] = useState<TLanguage[]>(project.languages);
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
    const newLanguage = { id: "new", createdAt: new Date(), updatedAt: new Date(), code: "", alias: "" };
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
      toast.error(t("common.something_went_wrong_please_try_again_later"));
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
      toast.error(t("common.something_went_wrong_please_try_again_later"));
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleCancelChanges = async () => {
    setLanguages(project.languages);
    setIsEditing(false);
  };

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
      <Button onClick={onClick} size="sm" variant="secondary" StartIcon={PlusIcon}>
        {t("environments.project.languages.add_language")}
      </Button>
    ) : null;

  return (
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
                onLanguageChange={(newLanguage: TLanguage) => {
                  const updatedLanguages = [...languages];
                  updatedLanguages[index] = newLanguage;
                  setLanguages(updatedLanguages);
                }}
              />
            ))}
          </>
        ) : (
          <p className="text-sm italic text-slate-500">
            {t("environments.project.languages.no_language_found")}
          </p>
        )}
        <AddLanguageButton onClick={handleAddLanguage} />
      </div>
      {!isReadOnly && (
        <EditSaveButtons
          isEditing={isEditing}
          onCancel={handleCancelChanges}
          onEdit={() => {
            setIsEditing(true);
          }}
          onSave={handleSaveChanges}
          t={t}
        />
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
  );
}

const EditSaveButtons: React.FC<{
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  t: (key: string) => string;
}> = ({ isEditing, onEdit, onSave, onCancel, t }) =>
  isEditing ? (
    <div className="flex gap-4">
      <Button onClick={onSave} size="sm">
        {t("common.save_changes")}
      </Button>
      <Button onClick={onCancel} size="sm" variant="minimal">
        {t("common.cancel")}
      </Button>
    </div>
  ) : (
    <Button className="w-fit" onClick={onEdit} size="sm">
      {t("environments.project.languages.edit_languages")}
    </Button>
  );
