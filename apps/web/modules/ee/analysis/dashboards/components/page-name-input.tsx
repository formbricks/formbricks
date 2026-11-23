"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { MAX_PAGE_NAME_LENGTH } from "@/modules/ee/analysis/dashboards/lib/page-names";

interface PageNameInputProps {
  initialName: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  className?: string;
}

/**
 * Renames a page in place: Enter or leaving the field keeps the name, Escape drops the change. An empty
 * name is not kept: the page keeps the one it had.
 */
export function PageNameInput({ initialName, onSubmit, onCancel, className }: Readonly<PageNameInputProps>) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const submit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== initialName) onSubmit(trimmed);
    else onCancel();
  };
  return (
    <input
      type="text"
      // Renaming starts from a deliberate click on Rename or the name, so the field takes focus.
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      value={name}
      maxLength={MAX_PAGE_NAME_LENGTH}
      aria-label={t("workspace.analysis.dashboards.page_name")}
      className={cn(
        "rounded-md border border-dashed border-slate-300 bg-transparent px-2 py-0.5 text-sm text-slate-800 focus:border-brand-dark focus:ring-0 focus:outline-hidden",
        className
      )}
      onChange={(event) => setName(event.target.value)}
      onBlur={submit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    />
  );
}
