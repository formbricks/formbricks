"use client";

import { AlertTriangle, ArrowUpRight, Info, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import Select from "react-select";

import { TLanguage, TLanguageInput, TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";

import { createLanguageAction, deleteLanguageAction, updateLanguageAction } from "../lib/actions";
import { iso639Languages } from "../lib/isoLanguages";

interface EditLanguageProps {
  product: TProduct;
  environmentId: string;
  isFormbricksCloud: boolean;
  isEnterpriseEdition: boolean;
}

const customStyles = {
  control: (provided) => ({
    ...provided,
    backgroundColor: "white",
    width: "100%",
    height: "100%",
    borderRadius: "5px",
    border: "",
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
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpenIndex, setDeleteModalOpenIndex] = useState<number | null>(null);
  const languageOptions = iso639Languages.map((language) => ({
    value: language.alpha2,
    label: `${language.english}`,
  }));

  const checkIfDuplicateExists = (arr: string[]) => {
    return new Set(arr).size !== arr.length;
  };

  useEffect(() => {
    setLanguages(product.languages);
  }, [product.languages]);

  const validateLanguage = (languages: TLanguage[]) => {
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

  const addNewLanguageField = () => {
    if (!isEnterpriseEdition) return;
    const newLanguage = {
      id: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
      code: "",
      alias: "",
    };
    setLanguages([...languages, newLanguage]);
    setIsEditing(true);
  };

  const deleteLanguage = async (languageId: string) => {
    setIsDeleting(true);
    try {
      await deleteLanguageAction(product.id, environmentId, languageId);
      const newLanguages = languages.filter((language) => language.id !== languageId);
      setLanguages(newLanguages);
      toast.success("Language deleted successfully");
    } catch (error) {
      toast.error("Error deleting language");
    } finally {
      setIsDeleting(false);
      setDeleteModalOpenIndex(null);
    }
  };

  const handleOnChange = (index: number, type: "code" | "alias", value: string) => {
    setIsEditing(true);
    const newLanguages = [...languages];
    newLanguages[index][type] = value;
    setLanguages(newLanguages);
  };

  const handleSave = async () => {
    if (!validateLanguage(languages)) {
      return;
    }
    setIsUpdating(true);
    try {
      await Promise.all(
        languages.map(async (language) => {
          const languageInput: TLanguageInput = { code: language.code, alias: language.alias };
          if (language.id === "new") {
            await createLanguageAction(product.id, environmentId, languageInput);
          } else {
            await updateLanguageAction(product.id, environmentId, language.id, languageInput);
          }
        })
      );
      toast.success("Languages updated successfully");
    } catch (error) {
      toast.error("Error saving language");
    } finally {
      setIsUpdating(false);
      setIsEditing(false);
    }
  };

  const AliasTooltip = () => {
    return (
      <TooltipProvider delayDuration={80}>
        <Tooltip>
          <TooltipTrigger tabIndex={-1}>
            <div>
              <Info className="h-4 w-4 text-slate-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            The alias is an alternate name to identify the language in link surveys and the SDK.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="flex ">
        <div className="space-y-4">
          <div className="grid w-full grid-cols-4 gap-4">
            <Label htmlFor="languagesId">Language</Label>
            <Label htmlFor="languagesId">Identifier</Label>
            <Label htmlFor="Alias" className="flex items-center space-x-2">
              <span>Alias</span> <AliasTooltip />
            </Label>
          </div>
          {languages.length > 0 ? (
            languages.map((language, index) => {
              return (
                <div key={index} className="grid grid-cols-4 gap-4">
                  <Select
                    className="flex"
                    value={languageOptions.find((option) => option.value === language.code)}
                    onChange={(selectedOption) => {
                      if (!selectedOption) return;
                      handleOnChange(index, "code", selectedOption.value);
                    }}
                    options={languageOptions}
                    isDisabled={!isEnterpriseEdition || index <= product.languages.length - 1}
                    isSearchable={true}
                    placeholder="English"
                    styles={customStyles}
                  />
                  <Input disabled={true} className="h-full" value={language.code} />
                  <Input
                    disabled={!isEnterpriseEdition}
                    className="h-full"
                    value={language.alias || ""}
                    placeholder="not provided"
                    onChange={(e) => handleOnChange(index, "alias", e.target.value)}
                  />
                  <div>
                    <Button
                      disabled={isEditing}
                      variant="warn"
                      onClick={() => {
                        if (isEditing) return;
                        setDeleteModalOpenIndex(index);
                      }}>
                      Remove
                    </Button>
                    <DeleteDialog
                      open={deleteModalOpenIndex === index}
                      setOpen={(open) => {
                        if (!open) setDeleteModalOpenIndex(null);
                      }}
                      deleteWhat="Language"
                      onDelete={() => deleteLanguage(language.id)}
                      isDeleting={isDeleting}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">You have not yet added a language</p>
          )}
        </div>
      </div>
      {isEditing && (
        <p className="my-2 pt-1 text-sm text-amber-600">
          Unsaved changes <AlertTriangle className="inline h-3 w-3" />{" "}
        </p>
      )}
      {!isEditing && (
        <Button
          variant="secondary"
          className="my-4 w-fit"
          onClick={addNewLanguageField}
          disabled={!isEnterpriseEdition}>
          Add Language
          <PlusIcon className="ml-2 h-4 w-4" />
        </Button>
      )}
      <div className="space-x-4">
        <Button variant="darkCTA" disabled={!isEditing} onClick={handleSave} loading={isUpdating}>
          Save changes
        </Button>
        <Button variant="secondary">
          Read Multi-Language docs
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
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
