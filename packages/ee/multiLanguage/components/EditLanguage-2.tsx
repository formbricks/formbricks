"use client";

import { InfoIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import Select, { CSSObjectWithLabel } from "react-select";

import { TLanguage, TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import ConfirmationModal from "@formbricks/ui/ConfirmationModal";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";

import {
  createLanguageAction,
  deleteLanguageAction,
  getSurveysUsingGivenLanguageAction,
  updateLanguageAction,
} from "../lib/actions";
import { iso639Languages } from "../lib/isoLanguages";

interface EditLanguageProps {
  product: TProduct;
  environmentId: string;
  isFormbricksCloud: boolean;
  isEnterpriseEdition: boolean;
}

const customSelectStyles = {
  control: (provided: CSSObjectWithLabel) => ({
    ...provided,
    backgroundColor: "white",
    width: "100%",
    height: "100%",
    borderRadius: "5px",
    borderColor: "#cbd5e1",
  }),
};

export default function EditLanguage({
  product,
  environmentId,
  isFormbricksCloud,
  isEnterpriseEdition,
}: EditLanguageProps) {
  const [languages, setLanguages] = useState<TLanguage[]>(product.languages);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, text: "", languageId: "" });

  useEffect(() => {
    setLanguages(product.languages);
  }, [product.languages]);

  const languageOptions = iso639Languages.map(({ alpha2, english }) => ({
    value: alpha2,
    label: english,
  }));

  const validateLanguages = () => {
    const codes = languages.map(({ code }) => code.toLowerCase().trim());
    const aliases = languages.map(({ alias }) => alias?.toLowerCase().trim()).filter(Boolean);
    const allIdentifiers = [...codes, ...aliases];
    const hasDuplicates = new Set(allIdentifiers).size !== allIdentifiers.length;
    if (hasDuplicates) {
      toast.error("Duplicate languages or aliases detected.", { duration: 4000 });
      return false;
    }
    return true;
  };

  const handleAddLanguage = () => {
    if (!isEnterpriseEdition) return;
    const newLanguage = { id: "new", createdAt: new Date(), updatedAt: new Date(), code: "", alias: "" };
    setLanguages((prev) => [...prev, newLanguage]);
    setIsEditing(true);
  };

  const handleDeleteLanguage = (languageId: string) => {
    setConfirmationModal({
      isOpen: true,
      languageId: languageId,
      text: "Are you sure you want to delete this language? This action cannot be undone.",
    });
  };

  const performLanguageDeletion = async (languageId: string) => {
    const surveysUsingLanguage = await getSurveysUsingGivenLanguageAction(product.id, languageId);
    if (surveysUsingLanguage.length > 0) {
      toast.error("Language is in use by surveys. Please remove it from those surveys before deleting.");
      // Close the modal after showing the error
      setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
      return;
    }
    await deleteLanguageAction(product.id, environmentId, languageId);
    setLanguages((prev) => prev.filter((lang) => lang.id !== languageId));
    toast.success("Language deleted successfully.");
    // Close the modal after deletion
    setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancelChanges = async () => {
    setLanguages(product.languages);
    setIsEditing(false);
  };

  const handleSaveChanges = async () => {
    if (!validateLanguages()) return;
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
    <div className="flex flex-col space-y-6">
      <div className="space-y-4">
        {languages.length > 0 ? (
          <>
            <LanguageLabels />
            {languages.map((language, index) => (
              <LanguageRow
                key={language.id}
                language={language}
                languageOptions={languageOptions}
                isEnterpriseEdition={isEnterpriseEdition}
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
        onSaveChanges={handleSaveChanges}
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
      />

      {!isEnterpriseEdition &&
        (!isFormbricksCloud ? (
          <UpgradePlanNotice
            message="To enable multi-language surveys,"
            url={`/environments/${environmentId}/settings/billing`}
            textForUrl="please add your credit card (free)."
          />
        ) : (
          <UpgradePlanNotice
            message="To manage access roles for your team,"
            url="https://formbricks.com/docs/self-hosting/license"
            textForUrl="get a self-hosting license (free)."
          />
        ))}
    </div>
  );
}

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
          The alias is an alternate name to identify the language in link surveys and the SDK.
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

type LanguageRowProps = {
  language: TLanguage;
  languageOptions: { value: string; label: string }[];
  isEnterpriseEdition: boolean;
  isEditing: boolean;
  index: number;
  onLanguageChange: (newLanguage: TLanguage) => void;
  onDelete: () => void;
};

const LanguageRow: React.FC<LanguageRowProps> = ({
  language,
  languageOptions,
  isEnterpriseEdition,
  isEditing,
  onLanguageChange,
  onDelete,
}) => (
  <div className="my-3 grid grid-cols-4 gap-4">
    <Select
      value={languageOptions.find((option) => option.value === language.code)}
      onChange={(selectedOption) => onLanguageChange({ ...language, code: selectedOption?.value || "" })}
      options={languageOptions}
      isDisabled={!isEnterpriseEdition || language.id !== "new"}
      isSearchable={true}
      placeholder="Search..."
      styles={customSelectStyles}
    />
    <Input disabled value={language.code} />
    <Input
      disabled={!isEnterpriseEdition || !isEditing}
      value={language.alias || ""}
      placeholder="e.g. en_us"
      onChange={(e) => onLanguageChange({ ...language, alias: e.target.value })}
    />

    {language.id !== "new" && isEditing && (
      <Button variant="warn" onClick={onDelete} className="w-fit" size="sm">
        Remove
      </Button>
    )}
  </div>
);

const EditSaveButtons: React.FC<{
  isEditing: boolean;
  onSaveChanges: () => void;
  onCancel: () => void;
  onEdit: () => void;
}> = ({ isEditing, onEdit, onSaveChanges, onCancel }) =>
  isEditing ? (
    <div className="flex gap-4">
      <Button variant="darkCTA" onClick={onSaveChanges}>
        Save Changes
      </Button>
      <Button variant="minimal" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  ) : (
    <Button variant="darkCTA" onClick={onEdit} className="w-fit">
      Edit Languages
    </Button>
  );
