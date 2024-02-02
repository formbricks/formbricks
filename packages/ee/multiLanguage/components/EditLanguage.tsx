"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { TrashIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { TLanguages, TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";

import { updateLangaugeAction } from "../lib/actions";

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
  const [defaultSymbol, setdefaultSymbol] = useState(product.languages["_default_"]);
  const initialLanguages = Object.entries(product.languages || {})
    .filter(([key]) => key !== "_default_")
    .sort(([key1], [key2]) => (key1 === defaultSymbol ? -1 : key2 === defaultSymbol ? 1 : 0));

  const [languages, setLanguages] = useState<string[][]>(initialLanguages);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteLanguageModalOpen, setIsDeleteLanguageModalOpen] = useState(false);
  const isInputDisabled = (index: number) => {
    if (isEditing) {
      return index > 0 && index < languages.length - 1;
    } else {
      return index > 0;
    }
  };

  const checkIfDuplicateExists = (arr: string[]) => {
    return new Set(arr).size !== arr.length;
  };

  const checkForDuplicates = (languages: string[][]) => {
    const languageIDs = languages.map((language) => language[0].toLowerCase());
    const languageNames = languages.map((language) => language[1].toLowerCase());
    if (checkIfDuplicateExists(languageNames) || checkIfDuplicateExists(languageIDs)) {
      return true;
    }
    return false;
  };

  const addNewLanguageField = () => {
    if (!isEnterpriseEdition) return;
    setLanguages((prevLanguages) => [...prevLanguages, ["", ""]]);
    setIsEditing(true);
  };

  const deleteLanguage = (index: number) => {
    setIsDeleting(true);
    const newLanguages = [...languages];
    newLanguages.splice(index, 1);
    const languagesObject = newLanguages.reduce<TLanguages>((acc, [key, value]) => {
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});
    handleSave(languagesObject);
    setLanguages(newLanguages);
    setIsDeleting(false);
  };

  const handleOnChange = (index: number, type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    setIsEditing(true);
    const newLanguages = [...languages];
    if (index === 0 && type === "symbol") {
      // meaning default language symbol is being changed
      setdefaultSymbol(e.target.value);
    }
    newLanguages[index][type === "symbol" ? 0 : 1] = e.target.value;
    setLanguages(newLanguages);
  };

  const updateLanguages = () => {
    if (checkForDuplicates(languages)) {
      toast.error("Duplicate language or language ID");
      return;
    }
    const languagesObject = languages.reduce<TLanguages>((acc, [key, value]) => {
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});
    languagesObject["_default_"] = defaultSymbol;
    handleSave(languagesObject);
  };

  const handleSave = async (languages: TLanguages) => {
    try {
      setIsUpdating(true);
      await updateLangaugeAction(product.id, languages, product.languages["_default_"] !== defaultSymbol);
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

  return (
    <div className="flex flex-col">
      <div className="flex space-x-4 space-y-2">
        <div className="w-96 space-y-2">
          <div className="flex w-full space-x-4">
            <Label className="w-1/2" htmlFor="languages">
              Language
            </Label>
            <Label htmlFor="languageId">Language ID</Label>
          </div>

          {languages.map((language, index) => {
            return (
              <div key={index} className="flex space-x-4">
                <div className="relative flex h-12 w-1/2 items-center justify-end">
                  <Input
                    disabled={!isEnterpriseEdition || isInputDisabled(index)}
                    placeholder="e.g., English"
                    className="absolute h-full w-full"
                    value={language[1]}
                    onChange={(e) => handleOnChange(index, "name", e)}
                  />
                  {language[1] === "English" && index === 0 && (
                    <span className="mr-2 rounded-2xl bg-slate-200 px-2 py-1 text-xs text-slate-500">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center">
                  <Input
                    disabled={!isEnterpriseEdition || isInputDisabled(index)}
                    placeholder="e.g., en"
                    className="h-12 w-24"
                    value={language[0]}
                    onChange={(e) => handleOnChange(index, "symbol", e)}
                  />
                  {index !== 0 && (
                    <TrashIcon
                      className="ml-2 h-4 w-4 cursor-pointer text-slate-400"
                      onClick={() => setIsDeleteLanguageModalOpen(true)}
                    />
                  )}
                </div>
                <DeleteDialog
                  open={isDeleteLanguageModalOpen}
                  setOpen={setIsDeleteLanguageModalOpen}
                  deleteWhat="Language"
                  onDelete={() => deleteLanguage(index)}
                  isDeleting={isDeleting}
                />
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
