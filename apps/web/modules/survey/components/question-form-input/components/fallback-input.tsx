import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { useTranslate } from "@tolgee/react";
import { RefObject } from "react";
import { toast } from "react-hot-toast";
import { TSurveyRecallItem } from "@formbricks/types/surveys/types";

interface FallbackInputProps {
  filteredRecallItems: (TSurveyRecallItem | undefined)[];
  fallbacks: { [type: string]: string };
  setFallbacks: (fallbacks: { [type: string]: string }) => void;
  fallbackInputRef: RefObject<HTMLInputElement>;
  addFallback: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const FallbackInput = ({
  filteredRecallItems,
  fallbacks,
  setFallbacks,
  fallbackInputRef,
  addFallback,
  open,
  setOpen,
}: FallbackInputProps) => {
  const { t } = useTranslate();
  const containsEmptyFallback = () => {
    const fallBacksList = Object.values(fallbacks);
    return fallBacksList.length === 0 || fallBacksList.map((value) => value.trim()).includes("");
  };

  return (
    <Popover open={open}>
      <PopoverTrigger asChild>
        <div className="z-10 h-0 w-full cursor-pointer" />
      </PopoverTrigger>

      <PopoverContent
        className="w-auto border border-slate-300 bg-slate-50 p-3 text-xs shadow-lg"
        align="start"
        side="bottom"
        sideOffset={4}>
        <p className="font-medium">{t("environments.surveys.edit.add_fallback_placeholder")}</p>

        <div className="mt-2 space-y-2">
          {filteredRecallItems.map((recallItem, idx) => {
            if (!recallItem) return null;
            return (
              <div key={recallItem.id} className="flex flex-col">
                <Input
                  className="placeholder:text-md h-full bg-white"
                  ref={idx === 0 ? fallbackInputRef : undefined}
                  id="fallback"
                  value={fallbacks[recallItem.id]?.replaceAll("nbsp", " ")}
                  placeholder={`${t("environments.surveys.edit.fallback_for")} ${recallItem.label}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (containsEmptyFallback()) {
                        toast.error(t("environments.surveys.edit.fallback_missing"));
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
            {t("environments.surveys.edit.add_fallback")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
