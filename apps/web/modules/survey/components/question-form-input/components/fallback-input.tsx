import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { RefObject, useState } from "react";
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
  const [open, setOpen] = useState(true);

  const containsEmptyFallback = () => {
    const fallBacksList = Object.values(fallbacks);
    return fallBacksList.length === 0 || fallBacksList.map((value) => value.trim()).includes("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && containsEmptyFallback()) return;
    setOpen(isOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div className="z-10 h-0 w-full cursor-pointer" />
      </PopoverTrigger>

      <PopoverContent
        className="w-auto border border-slate-300 bg-slate-50 p-3 text-xs shadow-lg"
        align="start"
        side="bottom"
        sideOffset={4}>
        <p className="font-medium">Add a placeholder to show if the question gets skipped:</p>

        <div className="mt-2 space-y-2 pr-1">
          {filteredRecallItems.map((recallItem, idx) => {
            if (!recallItem) return null;
            return (
              <div key={recallItem.id} className="flex flex-col">
                <Input
                  className="placeholder:text-md h-full bg-white"
                  ref={idx === 0 ? fallbackInputRef : undefined}
                  id="fallback"
                  value={fallbacks[recallItem.id]?.replaceAll("nbsp", " ")}
                  placeholder={"Fallback for " + recallItem.label}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (containsEmptyFallback()) {
                        toast.error("Fallback missing");
                        return;
                      }
                      addFallback();
                      setOpen(false);
                    }
                  }}
                  onChange={(e) => {
                    const newFallbacks = { ...fallbacks };
                    newFallbacks[recallItem.id] = e.target.value;
                    setFallbacks(newFallbacks);
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex w-full justify-end">
          <Button
            className="mt-2 h-full py-2"
            disabled={containsEmptyFallback()}
            onClick={(e) => {
              e.preventDefault();
              addFallback();
              setOpen(false);
            }}>
            Add
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
