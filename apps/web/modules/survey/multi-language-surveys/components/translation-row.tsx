"use client";

import DOMPurify from "isomorphic-dompurify";
import { useTranslation } from "react-i18next";
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

const DefaultTextCell = ({
  text,
  isRichText,
  noTextLabel,
}: {
  text: string;
  isRichText: boolean;
  noTextLabel: string;
}) => {
  if (!text) {
    return <div className="text-sm italic text-slate-400">{noTextLabel}</div>;
  }

  if (isRichText) {
    return (
      <div
        className="text-sm text-slate-700"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(text) }}
      />
    );
  }

  return <div className="text-sm text-slate-700">{text}</div>;
};

export const TranslationRow = ({ s, value, onChange, localSurvey, languageCode }: TranslationRowProps) => {
  const { t } = useTranslation();

  const defaultText = s.value.default || "";

  return (
    <tr className="border-b last:border-b-0" data-testid={`translation-row-${s.path}`}>
      <td className="py-2 pr-2 align-top">
        <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
          {s.displayId}
        </span>
        <div className="mt-0.5 text-[10px] text-slate-400">{s.fieldLabel}</div>
      </td>
      <td className="py-2 pr-2 align-top">
        <DefaultTextCell
          text={defaultText}
          isRichText={s.isRichText}
          noTextLabel={t("common.no_text_found")}
        />
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
