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
import { useTranslate } from "@tolgee/react";
import { HandshakeIcon, Undo2Icon } from "lucide-react";
import { TSurveyEndings } from "@formbricks/types/surveys/types";

interface EndingCardSelectorProps {
  endings: TSurveyEndings;
  value: string;
  onChange: (value: string) => void;
}

export const EndingCardSelector = ({ endings, value, onChange }: EndingCardSelectorProps) => {
  const availableEndings = endings;
  const { t } = useTranslate();
  const endingCards = availableEndings.filter((ending) => ending.type === "endScreen");
  const redirectToUrls = availableEndings.filter((ending) => ending.type === "redirectToUrl");

  return (
    <div className="space-y-1 text-sm">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={t("environments.surveys.edit.quotas.select_ending_card")} />
        </SelectTrigger>
        <SelectContent>
          {endingCards.length > 0 && (
            <SelectGroup>
              <div className="flex items-center gap-2 p-2 text-sm text-slate-500">
                <HandshakeIcon className="h-4 w-4" />
                <span>{t("common.ending_card")}</span>
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
                <span>{t("environments.surveys.edit.redirect_to_url")}</span>
              </div>
              {redirectToUrls.map((ending) => (
                <SelectItem key={ending.id} value={ending.id}>
                  {ending.label}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
