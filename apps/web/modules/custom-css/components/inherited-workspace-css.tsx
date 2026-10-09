"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { type TCustomCssAppearance, type TCustomCssInput } from "@formbricks/types/custom-css";
import { cn } from "@/lib/cn";
import { CssCodeField } from "./css-code-field";
import { type TCustomCssHealthStatus } from "./lib/api-client";
import { countLines } from "./lib/code-field";

// Long enough to read a rule or two at a glance; a longer stylesheet scrolls inside the field.
const MAX_VISIBLE_LINES = 10;

interface InheritedWorkspaceCssProps {
  source: TCustomCssInput | null;
  status: TCustomCssHealthStatus;
  appearanceHref: string;
}

/**
 * The workspace CSS a survey inherits, read-only and collapsed by default (ENG-3553). It applies
 * whether or not the survey overrides the theme, so it is shown either way.
 */
export const InheritedWorkspaceCss = ({
  source,
  status,
  appearanceHref,
}: Readonly<InheritedWorkspaceCssProps>) => {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  // Both stylesheets regardless of the Light / Dark tab, so the panel shows everything the survey inherits.
  const fields: TCustomCssAppearance[] = ["light", "dark"];
  const inherited = fields.flatMap((field) => {
    const css = source?.[field] ?? null;
    if (!css) return [];
    const label =
      field === "dark"
        ? t("workspace.custom_css.workspace_dark_css_label")
        : t("workspace.custom_css.workspace_base_css_label");
    return [{ field, css, label }];
  });
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
                  href={appearanceHref}
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
        {inherited.length > 0 ? (
          inherited.map(({ field, css, label }) => (
            <div key={field} className="flex flex-col gap-1">
              {/* Prefixed so neither reads like the survey's own fields below. */}
              <p className="text-xs font-medium text-slate-600">
                {label}
                {field === "light" && (
                  <span className="font-normal text-slate-500">
                    {" "}
                    · {t("workspace.custom_css.base_css_help")}
                  </span>
                )}
              </p>
              <CssCodeField
                // Read-only but focusable, so a keyboard user can scroll a long stylesheet.
                id={`${id}-${field}`}
                value={css}
                rows={Math.min(countLines(css), MAX_VISIBLE_LINES)}
                resizable={false}
                aria-label={label}
              />
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-500">{t("workspace.custom_css.workspace_css_empty")}</p>
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
