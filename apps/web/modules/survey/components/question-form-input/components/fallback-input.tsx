import { ReactNode } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { getTextContentWithRecallTruncated } from "@/lib/utils/recall";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

interface FallbackInputProps {
  filteredRecallItems: (TSurveyRecallItem | undefined)[];
  fallbacks: { [type: string]: string };
  setFallbacks: (fallbacks: { [type: string]: string }) => void;
  addFallback: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerButton?: ReactNode;
}

export const FallbackInput = ({
  filteredRecallItems,
  fallbacks,
  setFallbacks,
  addFallback,
  open,
  setOpen,
  triggerButton,
}: FallbackInputProps) => {
  const { t } = useTranslation();
  const containsEmptyFallback = () => {
    const fallBacksList = Object.values(fallbacks);
    return fallBacksList.length === 0 || fallBacksList.map((value) => value.trim()).includes("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {open ? <div className="z-10 h-0 w-full cursor-pointer" /> : triggerButton}
      </PopoverTrigger>

      <PopoverContent
        className="w-auto border border-slate-300 bg-slate-50 p-3 text-xs shadow-lg"
        align="start"
        side="bottom"
        sideOffset={4}>
        <p className="font-medium">{t("environments.surveys.edit.add_fallback_placeholder")}</p>

        <div className="mt-2 space-y-3">
          {filteredRecallItems.map((recallItem, idx) => {
            if (!recallItem) return null;
            const inputId = `fallback-${recallItem.id}`;
            return (
              <div key={recallItem.id} className="flex flex-col gap-1">
                <Label htmlFor={inputId} className="text-xs font-medium text-slate-700">
                  {getTextContentWithRecallTruncated(recallItem.label)}
                </Label>
                <Input
                  className="h-9 bg-white"
                  id={inputId}
                  autoFocus={idx === filteredRecallItems.length - 1}
                  value={fallbacks[recallItem.id]?.replaceAll("nbsp", " ") || ""}
                  placeholder={t("environments.surveys.edit.enter_fallback_value")}
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
            className="mt-2 h-9"
            disabled={containsEmptyFallback()}
            onClick={(e) => {
              e.preventDefault();
              addFallback();
              setOpen(false);
            }}>
            {t("common.save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
