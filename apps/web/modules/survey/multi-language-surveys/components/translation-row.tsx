"use client";

import { TSurvey } from "@formbricks/types/surveys/types";
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
  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2 pr-2 align-top">
        <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
          {s.displayId}
        </span>
        <div className="mt-0.5 text-[10px] text-slate-400">{s.fieldLabel}</div>
      </td>
      <td className="py-2 pr-2 align-top">
        {s.isRichText ? (
          <div
            className="text-sm text-slate-700"
            dangerouslySetInnerHTML={{ __html: s.value.default || "" }}
          />
        ) : (
          <div className="text-sm text-slate-700">{s.value.default || ""}</div>
        )}
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
