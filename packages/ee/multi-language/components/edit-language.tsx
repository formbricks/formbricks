"use client";

import { InfoIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { iso639Languages } from "@formbricks/lib/i18n/utils";
import type { TLanguage, TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { ConfirmationModal } from "@formbricks/ui/ConfirmationModal";
import { Label } from "@formbricks/ui/Label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import {
  createLanguageAction,
  deleteLanguageAction,
  getSurveysUsingGivenLanguageAction,
  updateLanguageAction,
} from "../lib/actions";
import { LanguageRow } from "./language-row";

interface EditLanguageProps {
  product: TProduct;
  environmentId: string;
}

const checkIfDuplicateExists = (arr: string[]) => {
  return new Set(arr).size !== arr.length;
};

const validateLanguages = (languages: TLanguage[]) => {
  const languageCodes = languages.map((language) => language.code.toLowerCase().trim());
  const languageAliases = languages
    .filter((language) => language.alias)
    .map((language) => language.alias!.toLowerCase().trim());

  if (languageCodes.includes("")) {
    toast.error("Please select a Language", { duration: 2000 });
    return false;
  }

  // Check for duplicates within the languageCodes and languageAliases
  if (checkIfDuplicateExists(languageAliases) || checkIfDuplicateExists(languageCodes)) {
    toast.error("Duplicate language or language ID", { duration: 4000 });
    return false;
  }

  // Check if any alias matches the identifier of any added languages
  if (languageCodes.some((code) => languageAliases.includes(code))) {
    toast.error(
      "There is a conflict between the identifier of an added language and one for your aliases. Aliases and identifiers cannot be identical.",
      { duration: 6000 }
    );
    return false;
  }

  // Check if the chosen alias matches an ISO identifier of a language that hasn’t been added
  for (const alias of languageAliases) {
    if (iso639Languages.some((language) => language.alpha2 === alias && !languageCodes.includes(alias))) {
      toast.error(
        "There is a conflict between the selected alias and another language that has this identifier. Please add the language with this identifier to your product instead to avoid inconsistencies.",
        { duration: 6000 }
      );
      return false;
    }
  }

  return true;
};

export function EditLanguage({ product, environmentId }: EditLanguageProps) {
  const [languages, setLanguages] = useState<TLanguage[]>(product.languages);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    text: "",
    languageId: "",
    isButtonDisabled: false,
  });

  useEffect(() => {
    setLanguages(product.languages);
  }, [product.languages]);

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
            text: `You cannot remove this language since it’s still used in these surveys:\n\n${surveyList}\n\nPlease remove the language from these surveys in order to remove it from the product.`,
            isButtonDisabled: true,
          });
        } else {
          setConfirmationModal({
            isOpen: true,
            languageId,
            text: "Are you sure you want to delete this language? This action cannot be undone.",
            isButtonDisabled: false,
          });
        }
      } else {
        const errorMessage = getFormattedErrorMessage(surveysUsingLanguageResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again later.");
    }
  };

  const performLanguageDeletion = async (languageId: string) => {
    try {
      await deleteLanguageAction({ environmentId, languageId });
      setLanguages((prev) => prev.filter((lang) => lang.id !== languageId));
      toast.success("Language deleted successfully.");
      // Close the modal after deletion
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      toast.error("Something went wrong. Please try again later.");
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleCancelChanges = async () => {
    setLanguages(product.languages);
    setIsEditing(false);
  };

  const handleSaveChanges = async () => {
    if (!validateLanguages(languages)) return;
    await Promise.all(
      languages.map((lang) => {
        return lang.id === "new"
          ? createLanguageAction({
              environmentId,
              languageInput: { code: lang.code, alias: lang.alias },
            })
          : updateLanguageAction({
              environmentId,
              languageId: lang.id,
              languageInput: { code: lang.code, alias: lang.alias },
            });
      })
    );
    toast.success("Languages updated successfully.");
    setIsEditing(false);
  };

  const AddLanguageButton: React.FC<{ onClick: () => void }> = ({ onClick }) =>
    isEditing && languages.length === product.languages.length ? (
      <Button onClick={onClick} size="sm" variant="secondary" StartIcon={PlusIcon}>
        Add language
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
          <p className="text-sm italic text-slate-500">No language found. Add your first language below.</p>
        )}
        <AddLanguageButton onClick={handleAddLanguage} />
      </div>
      <EditSaveButtons
        isEditing={isEditing}
        onCancel={handleCancelChanges}
        onEdit={() => {
          setIsEditing(true);
        }}
        onSave={handleSaveChanges}
      />
      <ConfirmationModal
        buttonText="Remove Language"
        isButtonDisabled={confirmationModal.isButtonDisabled}
        onConfirm={() => performLanguageDeletion(confirmationModal.languageId)}
        open={confirmationModal.isOpen}
        setOpen={() => {
          setConfirmationModal((prev) => ({ ...prev, isOpen: !prev.isOpen }));
        }}
        text={confirmationModal.text}
        title="Remove Language"
      />
    </div>
  );
}

function AliasTooltip() {
  return (
    <TooltipProvider delayDuration={80}>
      <Tooltip>
        <TooltipTrigger tabIndex={-1}>
          <div>
            <InfoIcon className="h-4 w-4 text-slate-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          The alias is an alternate name to identify the language in link surveys and the SDK (optional)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function LanguageLabels() {
  return (
    <div className="mb-2 grid w-full grid-cols-4 gap-4">
      <Label htmlFor="languagesId">Language</Label>
      <Label htmlFor="languagesId">Identifier (ISO)</Label>
      <Label className="flex items-center space-x-2" htmlFor="Alias">
        <span>Alias</span> <AliasTooltip />
      </Label>
    </div>
  );
}

const EditSaveButtons: React.FC<{
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
}> = ({ isEditing, onEdit, onSave, onCancel }) =>
  isEditing ? (
    <div className="flex gap-4">
      <Button onClick={onSave} size="sm">
        Save changes
      </Button>
      <Button onClick={onCancel} size="sm" variant="minimal">
        Cancel
      </Button>
    </div>
  ) : (
    <Button className="w-fit" onClick={onEdit} size="sm">
      Edit languages
    </Button>
  );
