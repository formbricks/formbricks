import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Input } from "@/modules/ui/components/input";
import { RefObject, useEffect, useState } from "react";
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

  // Prevent dropdown from closing when clicking outside
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen === false) {
      setOpen(true);
    } else {
      setOpen(isOpen);
    }
  };

  useEffect(() => {
    setOpen(true);
  }, []);

  const containsEmptyFallback = () => {
    return (
      Object.values(fallbacks)
        .map((value) => value.trim())
        .includes("") || Object.entries(fallbacks).length === 0
    );
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger className="z-10 cursor-pointer" asChild>
        <div className="flex h-0 w-full items-center justify-between overflow-hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-auto border-slate-300 bg-slate-50 p-3 text-xs shadow-lg"
        align="start"
        side="bottom">
        <p className="font-medium">Add a placeholder to show if the question gets skipped:</p>
        {filteredRecallItems.map((recallItem, idx) => {
          if (!recallItem) return;
          return (
            <div className="mt-2 flex flex-col" key={recallItem.id}>
              <div className="flex items-center">
                <Input
                  className="placeholder:text-md h-full bg-white"
                  ref={idx === 0 ? fallbackInputRef : undefined}
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
              setOpen(false);
            }}>
            Add
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
