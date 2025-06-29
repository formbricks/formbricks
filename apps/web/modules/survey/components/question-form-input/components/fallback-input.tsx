import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { RefObject } from "react";
import { toast } from "react-hot-toast";
import { TSurveyRecallItem } from "@formbricks/types/surveys/types";

interface FallbackInputProps {
  filteredRecallItems: (TSurveyRecallItem | undefined)[];
  fallbacks: { [type: string]: string };
  setFallbacks: (fallbacks: { [type: string]: string }) => void;
  fallbackInputRef: RefObject<HTMLInputElement>;
  addFallback: () => void;
}

export const FallbackInput = ({
  filteredRecallItems,
  fallbacks,
  setFallbacks,
  fallbackInputRef,
  addFallback,
}: FallbackInputProps) => {
  const containsEmptyFallback = () => {
    return (
      Object.values(fallbacks)
        .map((value) => value.trim())
        .includes("") || Object.entries(fallbacks).length === 0
    );
  };
  return (
    <div className="absolute top-10 z-10 mt-1 rounded-md border border-slate-300 bg-slate-50 p-3 text-xs">
      <p className="font-medium">Add a placeholder to show if the question gets skipped:</p>
      {filteredRecallItems.map((recallItem) => {
        if (!recallItem) return;
        return (
          <div className="mt-2 flex flex-col" key={recallItem.id}>
            <div className="flex items-center">
              <Input
                className="placeholder:text-md h-full bg-white"
                ref={fallbackInputRef}
                id="fallback"
                value={fallbacks[recallItem.id]?.replaceAll("nbsp", " ")}
                placeholder={"Fallback for " + recallItem.label}
                onKeyDown={(e) => {
                  if (e.key == "Enter") {
                    e.preventDefault();
                    if (containsEmptyFallback()) {
                      toast.error("Fallback missing");
                      return;
                    }
                    addFallback();
                  }
                }}
                onChange={(e) => {
                  const newFallbacks = { ...fallbacks };
                  newFallbacks[recallItem.id] = e.target.value;
                  setFallbacks(newFallbacks);
                }}
              />
            </div>
          </div>
        );
      })}
      <div className="flex w-full justify-end">
        <Button
          className="mt-2 h-full py-2"
          disabled={containsEmptyFallback()}
          onClick={(e) => {
            e.preventDefault();
            addFallback();
          }}>
          Add
        </Button>
      </div>
    </div>
  );
};
