"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { TrashIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import Select from "react-select";

import { getDefaultLanguage } from "@formbricks/lib/i18n/utils";
import { TLanguage, TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";

import { updateProductAction } from "../lib/actions";
import { iso639Identifiers } from "../utils/ISOLanguages";

interface EditLanguageProps {
  product: TProduct;
  environmentId: string;
  isFormbricksCloud: boolean;
  isEnterpriseEdition: boolean;
}

export default function EditLanguage({
  product,
  environmentId,
  isFormbricksCloud,
  isEnterpriseEdition,
}: EditLanguageProps) {
  const [defaultSymbol, setdefaultSymbol] = useState(getDefaultLanguage(product.languages).id);
  const initialLanguages = product.languages.sort((key1, key2) =>
    key1.id === defaultSymbol ? -1 : key2.id === defaultSymbol ? 1 : 0
  );

  const [languages, setLanguages] = useState<TLanguage[]>(initialLanguages);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpenIndex, setDeleteModalOpenIndex] = useState<number | null>(null);
  const languageOptions = iso639Identifiers.map((code) => ({
    value: code,
    label: code,
  }));

  const checkIfDuplicateExists = (arr: string[]) => {
    return new Set(arr).size !== arr.length;
  };

  useEffect(() => {
    if (isEditing) return;
    setLanguages(
      languages.sort((key1, key2) => (key1.id === defaultSymbol ? -1 : key2.id === defaultSymbol ? 1 : 0))
    );
  }, [isEditing, languages]);

  const validateLanguage = (languages: TLanguage[]) => {
    const languageIDs = languages.map((language) => language.id.toLowerCase().trim());
    const languageNames = languages.map((language) => language.alias.toLowerCase().trim());
    if (checkIfDuplicateExists(languageNames) || checkIfDuplicateExists(languageIDs)) {
      toast.error("Duplicate language or language ID");
      return false;
    }
    if (languageIDs.includes("") || languageNames.includes("")) {
      toast.error("Missing language or language ID");
      return false;
    }

    return true;
  };

  const addNewLanguageField = () => {
    if (!isEnterpriseEdition) return;
    setLanguages((prevLanguages) => [
      ...prevLanguages,
      {
        id: "",
        alias: "",
        default: false,
      },
    ]);
    setIsEditing(true);
  };

  const deleteLanguage = (id: string) => {
    setIsDeleting(true);
    const newLanguages = languages.filter((language) => language.id !== id);
    handleSave(newLanguages);
    setLanguages(newLanguages);
    setIsDeleting(false);
    setDeleteModalOpenIndex(null);
  };

  const handleOnChange = (index: number, type: "id" | "alias", value: string) => {
    setIsEditing(true);
    const newLanguages = [...languages];
    if (index === 0 && type === "id") {
      // meaning default language symbol is being changed
      setdefaultSymbol(value);
    }
    newLanguages[index][type] = value;
    setLanguages(newLanguages);
  };

  const updateLanguages = () => {
    if (!validateLanguage(languages)) {
      return;
    }
    handleSave(languages);
  };

  const markAsDefault = (languageId: string) => {
    const newLanguages = [...languages];
    const defaultLanguage = newLanguages.find((language) => language.id === defaultSymbol);
    if (defaultLanguage) {
      defaultLanguage.default = false;
    }
    const newDefaultLanguage = newLanguages.find((language) => language.id === languageId);
    if (newDefaultLanguage) {
      newDefaultLanguage.default = true;
      setdefaultSymbol(newDefaultLanguage.id);
    }
    setLanguages(newLanguages);
    handleSave(newLanguages);
  };

  const handleSave = async (languages: TLanguage[]) => {
    try {
      setIsUpdating(true);
      await updateProductAction(product.id, { languages });
      setIsEditing(false);
      setIsUpdating(false);
      toast.success("Lanuages updated successfully");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
      setIsUpdating(false);
    }
  };

  const isLanguageSelectDisable = (index: number) => {
    if (!isEditing) return true;
    else {
      if (index < product.languages.length) {
        return true;
      }
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex ">
        <div className="space-y-4">
          <div className="flex w-full space-x-4">
            <Label className="w-28" htmlFor="languagesId">
              Language ID
            </Label>
            <Label htmlFor="Alias">Alias</Label>
          </div>

          {languages.map((language, index) => {
            return (
              <div key={index} className=" flex items-center space-x-6">
                <div className="flex items-center">
                  <Select
                    className=" h-full w-24"
                    value={languageOptions.find((option) => option.value === language.id)}
                    onChange={(selectedOption) => {
                      if (!selectedOption) return;
                      handleOnChange(index, "id", selectedOption.value);
                    }}
                    options={languageOptions}
                    isDisabled={!isEnterpriseEdition || isLanguageSelectDisable(index)}
                    isSearchable={true}
                    placeholder="en"
                  />
                </div>
                <div className="flex h-12 w-1/2  ">
                  <div className="relative h-full">
                    <Input
                      disabled={!isEnterpriseEdition}
                      placeholder="English"
                      className="h-full w-40"
                      value={language.alias}
                      onChange={(e) => handleOnChange(index, "alias", e.target.value)}
                    />
                    {language.id === defaultSymbol && (
                      <span className="absolute right-2 top-3 rounded-2xl bg-slate-200 px-2 py-1 text-xs text-slate-500">
                        Default
                      </span>
                    )}
                  </div>
                </div>
                {language.default !== true ? (
                  <div>
                    <TrashIcon
                      className=" h-5 w-5 cursor-pointer text-slate-400"
                      onClick={() => {
                        if (isEditing) return;
                        setDeleteModalOpenIndex(index);
                      }}
                    />
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
                ) : (
                  <div className="h-6 w-6"></div>
                )}
                {language.default === false && (
                  <Button
                    variant="darkCTA"
                    disabled={index === product.languages.length || isEditing}
                    className="whitespace-nowrap"
                    onClick={() => markAsDefault(language.id)}
                    loading={isUpdating}>
                    Mark as default
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {isEditing && (
        <p className="pt-1 text-sm text-amber-600">
          Unsaved changes <ExclamationTriangleIcon className="inline h-3 w-3" />{" "}
        </p>
      )}
      {isEditing ? (
        <Button variant="darkCTA" className="mt-4 w-fit" onClick={updateLanguages} loading={isUpdating}>
          Save
        </Button>
      ) : (
        <Button
          variant="darkCTA"
          className="my-4 w-fit"
          onClick={addNewLanguageField}
          disabled={!isEnterpriseEdition}>
          Add Language
        </Button>
      )}
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
