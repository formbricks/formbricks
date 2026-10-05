"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { type TCustomCssAppearance, type TCustomCssInput } from "@formbricks/types/custom-css";
import { cn } from "@/lib/cn";
import { type TCustomCssHealthStatus } from "./lib/api-client";

interface InheritedWorkspaceCssProps {
  source: TCustomCssInput | null;
  status: TCustomCssHealthStatus;
  appearance: TCustomCssAppearance;
  lookAndFeelHref: string;
}

/**
 * The workspace CSS a survey inherits, read-only and collapsed by default (ENG-3553). It applies
 * whether or not the survey overrides the theme (D16), so it is shown either way.
 */
export const InheritedWorkspaceCss = ({
  source,
  status,
  appearance,
  lookAndFeelHref,
}: Readonly<InheritedWorkspaceCssProps>) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const css = source?.[appearance] ?? null;
  const fieldLabel =
    appearance === "dark"
      ? t("workspace.custom_css.dark_css_label")
      : t("workspace.custom_css.base_css_label");

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="rounded-md border border-slate-200">
      <Collapsible.Trigger className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none">
        <span>{t("workspace.custom_css.workspace_css_label")}</span>
        <ChevronDownIcon
          className={cn("size-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="flex flex-col gap-2 px-3 pb-3">
        <p className="text-xs text-slate-500">
          <Trans
            i18nKey="workspace.custom_css.workspace_css_help"
            components={{
              lookFeelLink: (
                <Link
                  href={lookAndFeelHref}
                  target="_blank"
                  className="font-medium text-slate-700 underline underline-offset-2"
                />
              ),
            }}
          />
        </p>
        {status === "withheld" && (
          <p className="text-xs text-amber-800">{t("workspace.custom_css.withheld_warning")}</p>
        )}
        {css ? (
          <pre
            // Focusable so a keyboard user can scroll a long stylesheet.
            tabIndex={0}
            aria-label={`${t("workspace.custom_css.workspace_css_label")}: ${fieldLabel}`}
            className="max-h-60 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none">
            {css}
          </pre>
        ) : (
          <p className="text-xs text-slate-500">{t("workspace.custom_css.workspace_css_empty")}</p>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
