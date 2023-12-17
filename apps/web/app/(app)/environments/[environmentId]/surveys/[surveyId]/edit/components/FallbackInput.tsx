import React from "react";

import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";

export default function FallbackInput({
  filteredRecallQuestions,
  fallbacks,
  setFallbacks,
  fallbackInputRef,
  addFallback,
}) {
  return (
    <div className="fixed z-30 border bg-white p-4 text-xs">
      <p className="font-medium">Add a fallback, if the data is missing</p>
      {filteredRecallQuestions.map((recallQuestion) => (
        <div className="mt-4 flex flex-col">
          <p className="mb-2 text-xs">{recallQuestion!.headline}</p>
          <div className="flex items-center">
            <Input
              className="h-full"
              ref={fallbackInputRef}
              id="fallback"
              value={fallbacks[recallQuestion!.id].replaceAll("nbsp", " ")}
              onChange={(e) => {
                const newFallbacks = { ...fallbacks };
                newFallbacks[recallQuestion!.id] = e.target.value;
                setFallbacks(newFallbacks);
              }}
            />
          </div>
        </div>
      ))}
      <div className="flex w-full justify-end">
        <Button
          className=" mt-2 h-full py-2"
          disabled={Object.values(fallbacks).includes("") || Object.entries(fallbacks).length === 0}
          variant="darkCTA"
          onClick={(e) => {
            e.preventDefault();
            addFallback();
          }}>
          Add
        </Button>
      </div>
    </div>
  );
}
