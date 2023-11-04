"use client";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

export default function EditLanguage() {
  const [languages, setLanguages] = useState([
    ["English", "en"],
    ["German", "gm"],
    ["Hindi", "hn"],
  ]);

  const addNewLanguage = () => {
    setLanguages((prevLanguages) => [...prevLanguages, ["", ""]]);
  };

  const deleteLanguage = (index) => {
    const newLanguages = [...languages];
    newLanguages.splice(index, 1);
    setLanguages(newLanguages);
  };

  const handleOnChange = (index, type, e) => {
    const newLanguages = [...languages];
    if (type === "name") {
      newLanguages[index][0] = e.target.value;
    } else if (type === "symbol") {
      newLanguages[index][1] = e.target.value;
    }
    setLanguages(newLanguages);
  };

  return (
    <div className="flex flex-col">
      <div className="flex space-x-4 space-y-2">
        <div className="w-96 space-y-2">
          <div className=" flex w-full space-x-4">
            <Label className="w-1/2" htmlFor="languages">
              Language
            </Label>
            <Label htmlFor="languageId">Language ID</Label>
          </div>

          {languages &&
            languages.map((language, index) => {
              return (
                <div className="flex space-x-4">
                  <div className="relative flex h-12 w-1/2 items-center justify-end">
                    <Input
                      placeholder="language"
                      className="absolute h-full w-full"
                      value={language[0]}
                      onChange={(e) => handleOnChange(index, "name", e)}
                    />
                    {index === 0 && (
                      <span className=" mr-2 rounded-2xl bg-slate-200 px-2 py-1 text-xs text-slate-500">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center">
                    <Input
                      placeholder="symbol"
                      className="h-12 w-24"
                      value={language[1]}
                      onChange={(e) => handleOnChange(index, "symbol", e)}
                    />
                    <PencilIcon className="ml-2 h-4 w-4 cursor-pointer text-slate-400" />
                    {index !== 0 && (
                      <TrashIcon
                        className="ml-2 h-4 w-4 cursor-pointer text-slate-400"
                        onClick={() => {
                          deleteLanguage(index);
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <Button variant="darkCTA" className=" mt-4 w-fit" onClick={addNewLanguage}>
        Add Language
      </Button>
    </div>
  );
}
