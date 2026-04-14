"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { Input } from "@/modules/ui/components/input";
import { type TranslatableString } from "../lib/types";
import { RichTextTranslationInput } from "./rich-text-translation-input";

interface TranslationRowProps {
  s: TranslatableString;
  value: string;
  onChange: (path: string, value: string) => void;
  localSurvey: TSurvey;
  languageCode: string;
}

export const TranslationRow = ({ s, value, onChange, localSurvey, languageCode }: TranslationRowProps) => {
  const [copied, setCopied] = useState(false);

  const defaultText = s.value.default || "";
  const plainText = s.isRichText ? getTextContent(defaultText) : defaultText;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <tr className="border-b last:border-b-0" data-testid={`translation-row-${s.path}`}>
      <td className="py-2 pr-2 align-top">
        <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
          {s.displayId}
        </span>
        <div className="mt-0.5 text-[10px] text-slate-400">{s.fieldLabel}</div>
      </td>
      <td className="py-2 pr-2 align-top">
        <div className="flex items-start gap-1">
          {s.isRichText ? (
            <div
              className="min-w-0 flex-1 text-sm text-slate-700"
              dangerouslySetInnerHTML={{ __html: defaultText }}
            />
          ) : (
            <div className="min-w-0 flex-1 text-sm text-slate-700">{defaultText}</div>
          )}
          {plainText && (
            <button
              type="button"
              onClick={handleCopy}
              className="mt-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600">
              {copied ? (
                <CheckIcon className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </td>
      <td className="py-2 align-top">
        {s.isRichText ? (
          <RichTextTranslationInput
            path={s.path}
            value={value}
            onChange={onChange}
            localSurvey={localSurvey}
            languageCode={languageCode}
            elementId={s.elementId}
          />
        ) : (
          <Input
            dir="auto"
            className="text-sm"
            value={value}
            onChange={(e) => onChange(s.path, e.target.value)}
            placeholder=""
          />
        )}
      </td>
    </tr>
  );
};
