"use client";

import { HandshakeIcon, Undo2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { recallToHeadline } from "@/lib/utils/recall";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface EndingCardSelectorProps {
  survey: TSurvey;
  value: string;
  onChange: (value: string) => void;
}

export const EndingCardSelector = ({ survey, value, onChange }: EndingCardSelectorProps) => {
  const endings = survey.endings;
  const { t } = useTranslation();
  const endingCards = endings.filter((ending) => ending.type === "endScreen");
  const redirectToUrls = endings.filter((ending) => ending.type === "redirectToUrl");

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
                  {getTextContent(
                    recallToHeadline(ending.headline ?? {}, survey, false, "default")["default"]
                  )}
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
