"use client";
import { TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { TProductUpdateInput } from "@formbricks/types/product";
import { updateProductAction } from "../lookandfeel/actions";
import { toast } from "react-hot-toast";

export default function EditLanguage({ product }: { product: TProduct }) {
  const initialLanguages = Object.entries(product.languages || {}).sort(([key1], [key2]) =>
    key1 === "en" ? -1 : key2 === "en" ? 1 : 0
  );
  const [languages, setLanguages] = useState(initialLanguages);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const addNewLanguageField = () => {
    setLanguages((prevLanguages) => [...prevLanguages, ["", ""]]);
    setIsEditing(true);
  };

  const deleteLanguage = (index) => {
    const newLanguages = [...languages];
    newLanguages.splice(index, 1);
    const languagesObject: Partial<TProductUpdateInput> = newLanguages.reduce((acc, [key, value]) => {
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});
    handleSave(languagesObject);
    setLanguages(newLanguages);
    setIsEditing(false);
  };

  const handleOnChange = (index, type, e) => {
    setIsEditing(true); // Set editing state to true when change begins
    const newLanguages = [...languages];
    newLanguages[index][type === "symbol" ? 0 : 1] = e.target.value;
    setLanguages(newLanguages);
  };

  const updateLanguages = () => {
    const languagesObject: Partial<TProductUpdateInput> = languages.reduce((acc, [key, value]) => {
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});
    handleSave(languagesObject);
  };

  const handleSave = async (languages) => {
    try {
      setIsUpdating(true);
      await updateProductAction(product.id, { languages });
      setIsEditing(false);
      setIsUpdating(false);
      toast.success("Lanuages updated successfully");
    } catch (error) {
      toast.error(error);
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

          {languages.map((language, index) => (
            <div key={index} className="flex space-x-4">
              <div className="relative flex h-12 w-1/2 items-center justify-end">
                <Input
                  placeholder="e.g., English"
                  className="absolute h-full w-full"
                  value={language[1]}
                  onChange={(e) => handleOnChange(index, "name", e)}
                />
                {language[1] === "English" && (
                  <span className="mr-2 rounded-2xl bg-slate-200 px-2 py-1 text-xs text-slate-500">
                    Default
                  </span>
                )}
              </div>
              <div className="flex items-center">
                <Input
                  placeholder="e.g., en"
                  className="h-12 w-24"
                  value={language[0]}
                  onChange={(e) => handleOnChange(index, "symbol", e)}
                />
                {index !== 0 && <PencilIcon className="ml-2 h-4 w-4 cursor-pointer text-slate-400" />}
                {index !== 0 && (
                  <TrashIcon
                    className="ml-2 h-4 w-4 cursor-pointer text-slate-400"
                    onClick={() => deleteLanguage(index)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {isEditing ? (
        <Button variant="darkCTA" className="mt-4 w-fit" onClick={updateLanguages} loading={isUpdating}>
          Save
        </Button>
      ) : (
        <Button variant="darkCTA" className="mt-4 w-fit" onClick={addNewLanguageField}>
          Add Language
        </Button>
      )}
    </div>
  );
}
