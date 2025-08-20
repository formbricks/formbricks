"use client";

import { getLocalizedValue } from "@/lib/i18n/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { HandshakeIcon, Undo2Icon } from "lucide-react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface EndingCardSelectorProps {
  survey: TSurvey;
  value: string;
  onChange: (value: string) => void;
}

export const EndingCardSelector = ({ survey, value, onChange }: EndingCardSelectorProps) => {
  const availableEndings = survey.endings || [];

  const endingCards = availableEndings.filter((ending) => ending.type === "endScreen");
  const redirectToUrls = availableEndings.filter((ending) => ending.type === "redirectToUrl");

  return (
    <div className="space-y-1 text-sm">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select ending card" />
        </SelectTrigger>
        <SelectContent>
          {endingCards.length > 0 && (
            <SelectGroup>
              <div className="flex items-center gap-2 p-2 text-sm text-slate-500">
                <HandshakeIcon className="h-4 w-4" />
                <span>Ending Card</span>
              </div>
              {/* Custom endings */}
              {endingCards.map((ending) => (
                <SelectItem key={ending.id} value={ending.id}>
                  {getLocalizedValue(ending.headline, "default")}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {redirectToUrls.length > 0 && (
            <SelectGroup>
              <div className="flex items-center gap-2 p-2 text-sm text-slate-500">
                <Undo2Icon className="h-4 w-4" />
                <span>Redirect to URL</span>
              </div>
              {redirectToUrls.map((ending, index) => (
                <SelectItem key={ending.id} value={ending.id}>
                  Redirect to URL {index + 1}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
