"use client";

import { InfoIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { TLanguage, TProduct } from "@formbricks/types/product";
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
import { iso639Languages } from "../lib/isoLanguages";
import { LanguageRow } from "./LanguageRow";

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
  for (let alias of languageAliases) {
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

export const EditLanguage = ({ product, environmentId }: EditLanguageProps) => {
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
      const surveysUsingLanguage = await getSurveysUsingGivenLanguageAction(product.id, languageId);

      if (surveysUsingLanguage.length > 0) {
        const surveyList = surveysUsingLanguage.map((surveyName) => `• ${surveyName}`).join("\n");
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
    } catch (err) {
      toast.error("Something went wrong. Please try again later.");
    }
  };

  const performLanguageDeletion = async (languageId: string) => {
    try {
      await deleteLanguageAction(product.id, environmentId, languageId);
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
          ? createLanguageAction(product.id, environmentId, { code: lang.code, alias: lang.alias })
          : updateLanguageAction(product.id, environmentId, lang.id, { code: lang.code, alias: lang.alias });
      })
    );
    toast.success("Languages updated successfully.");
    setIsEditing(false);
  };

  const AddLanguageButton: React.FC<{ onClick: () => void }> = ({ onClick }) =>
    isEditing && languages.length === product.languages.length ? (
      <Button variant="secondary" onClick={onClick} size="sm">
        <PlusIcon /> Add Language
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
                key={language.id}
                language={language}
                isEditing={isEditing}
                index={index}
                onLanguageChange={(newLanguage: TLanguage) => {
                  const updatedLanguages = [...languages];
                  updatedLanguages[index] = newLanguage;
                  setLanguages(updatedLanguages);
                }}
                onDelete={() => handleDeleteLanguage(language.id)}
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
        onSave={handleSaveChanges}
        onCancel={handleCancelChanges}
        onEdit={() => setIsEditing(true)}
      />
      <ConfirmationModal
        title="Remove Language"
        buttonText={"Remove Language"}
        open={confirmationModal.isOpen}
        setOpen={() => setConfirmationModal((prev) => ({ ...prev, isOpen: !prev.isOpen }))}
        text={confirmationModal.text}
        onConfirm={() => performLanguageDeletion(confirmationModal.languageId)}
        isButtonDisabled={confirmationModal.isButtonDisabled}
      />
    </div>
  );
};

const AliasTooltip = () => {
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
};

const LanguageLabels = () => (
  <div className="mb-2 grid w-full grid-cols-4 gap-4">
    <Label htmlFor="languagesId">Language</Label>
    <Label htmlFor="languagesId">Identifier (ISO)</Label>
    <Label htmlFor="Alias" className="flex items-center space-x-2">
      <span>Alias</span> <AliasTooltip />
    </Label>
  </div>
);

const EditSaveButtons: React.FC<{
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
}> = ({ isEditing, onEdit, onSave, onCancel }) =>
  isEditing ? (
    <div className="flex gap-4">
      <Button variant="darkCTA" size="sm" onClick={onSave}>
        Save Changes
      </Button>
      <Button variant="minimal" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  ) : (
    <Button variant="darkCTA" size="sm" onClick={onEdit} className="w-fit">
      Edit Languages
    </Button>
  );
