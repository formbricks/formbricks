"use client";

import { useTranslation } from "react-i18next";
import { Input } from "@/modules/ui/components/input";

interface PrettyUrlInputProps {
  value: string;
  onChange: (value: string) => void;
  publicDomain: string;
  disabled?: boolean;
}

export const PrettyUrlInput = ({ value, onChange, publicDomain, disabled = false }: PrettyUrlInputProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center overflow-hidden rounded-md border border-slate-300 bg-white">
      <span className="flex-shrink-0 border-r border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {publicDomain}/p/
      </span>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase().replaceAll(/[^a-z0-9-]/g, ""))}
        placeholder={t("environments.surveys.share.pretty_url.slug_placeholder")}
        disabled={disabled}
        className="border-0 bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
};
