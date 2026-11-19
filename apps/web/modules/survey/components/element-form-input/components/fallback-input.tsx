import { ReactNode, useRef } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { getTextContentWithRecallTruncated } from "@/lib/utils/recall";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { focusOnOpen } from "@/modules/ui/lib/focus-on-open";

interface FallbackInputProps {
  readonly filteredRecallItems: (TSurveyRecallItem | undefined)[];
  readonly fallbacks: { [type: string]: string };
  readonly setFallbacks: (fallbacks: { [type: string]: string }) => void;
  readonly addFallback: () => void;
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly triggerButton?: ReactNode;
  /** The recall item whose field takes focus on open (a clicked chip); else the newest one's. */
  readonly focusItemId?: string;
}

export const FallbackInput = ({
  filteredRecallItems,
  fallbacks,
  setFallbacks,
  addFallback,
  open,
  setOpen,
  triggerButton,
  focusItemId,
}: FallbackInputProps) => {
  const { t } = useTranslation();
  // The newest recall item's fallback, which is the one the user just inserted.
  const lastInputRef = useRef<HTMLInputElement>(null);
  const containsEmptyFallback = () => {
    const fallBacksList = Object.values(fallbacks);
    return fallBacksList.length === 0 || fallBacksList.map((value) => value.trim()).includes("");
  };

  return (
    // Closing by clicking outside or Escape keeps what was typed: every field is applied to its
    // Variable, an empty one too (it stays without a fallback, which the editor's own checks catch).
    // Kept only in this popover's state, typing would be lost on the editor's next update.
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) addFallback();
        setOpen(next);
      }}>
      <PopoverTrigger asChild>
        {open || !triggerButton ? <div className="z-10 h-0 w-full cursor-pointer" /> : triggerButton}
      </PopoverTrigger>

      <PopoverContent
        className="w-auto border border-slate-300 bg-slate-50 p-3 text-xs shadow-lg"
        align="start"
        side="bottom"
        sideOffset={4}
        // Closes on a click outside or Escape, never on focus leaving: the recall picker that opens
        // this popover hands focus back to the editor as it closes, which would close it at once.
        onFocusOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) =>
          focusOnOpen(
            event,
            (focusItemId ? document.getElementById(`fallback-${focusItemId}`) : null) ?? lastInputRef.current
          )
        }>
        <p className="font-medium">{t("workspace.surveys.edit.add_fallback_placeholder")}</p>

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
                  ref={idx === filteredRecallItems.length - 1 ? lastInputRef : undefined}
                  value={fallbacks[recallItem.id]?.replaceAll("nbsp", " ") || ""}
                  placeholder={t("workspace.surveys.edit.enter_fallback_value")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (containsEmptyFallback()) {
                        toast.error(t("workspace.surveys.edit.fallback_missing"));
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
