"use client";

import { ArrowUpRightIcon, EllipsisVerticalIcon, LanguagesIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { type Dispatch, type SetStateAction, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/utils";
import { cn } from "@/lib/cn";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Editor } from "@/modules/ui/components/editor";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import { bannerHtmlToRuns, bannerRunsToHtml } from "../../lib/banner-text";
import type { TDestinationSurveyOption } from "../../lib/destination-options";
import type { TCreativeEditorForm, TCreativeTranslation } from "../../lib/editor-form";
import {
  EMPTY_TRANSLATION,
  type TTranslatableField,
  addCreativeLanguage,
  getTranslatableFields,
  getTranslationProgress,
  makeDefaultLanguage,
  removeCreativeLanguage,
  setCreativeLanguageEnabled,
  updateTranslation,
} from "../../lib/languages-form";
import { getUiLocale } from "../../lib/ui-locale";
import { BANNER_EXCLUDED_TOOLBAR_ITEMS, MAX_TEXT_LENGTH } from "./content-tab";
import { EditorField, EditorPanel } from "./editor-primitives";
import { SurveyLanguageWarning } from "./survey-language-warning";

type TSetForm = Dispatch<SetStateAction<TCreativeEditorForm>>;

/** Each translatable text with the default language's value, as the translation fields show it. */
const getDefaultTexts = (content: TCreativeEditorForm["content"]): TCreativeTranslation =>
  content.type === "feedbackButton"
    ? { ...EMPTY_TRANSLATION, label: content.label }
    : {
        ...EMPTY_TRANSLATION,
        message: content.message,
        buttonLabel: content.buttonLabel,
        accessibleName: content.accessibleName,
      };

const TranslationFields = ({
  form,
  setForm,
  code,
  languageName,
}: Readonly<{ form: TCreativeEditorForm; setForm: TSetForm; code: string; languageName: string }>) => {
  const { t } = useTranslation();
  const ids = useId();
  const translation = form.languages.texts[code] ?? EMPTY_TRANSLATION;
  const defaults = getDefaultTexts(form.content);
  const update = (patch: Partial<TCreativeTranslation>) =>
    setForm((current) => ({ ...current, languages: updateTranslation(current.languages, code, patch) }));

  const fieldLabels: Record<TTranslatableField, string> = {
    label: t("common.label"),
    message: t("workspace.creatives.editor.message_text"),
    buttonLabel: t("workspace.creatives.editor.button_label"),
    accessibleName: t("workspace.creatives.editor.accessible_name"),
  };

  return (
    <EditorPanel
      title={t("workspace.creatives.editor.translation_title", { language: languageName })}
      description={t("workspace.creatives.editor.translation_description")}>
      {getTranslatableFields(form.content).map((field) =>
        field === "message" ? (
          <div key={field} className="space-y-1.5">
            <p id={`${ids}-message`} className="text-sm font-medium text-slate-700">
              {fieldLabels.message}
            </p>
            {/* The editor reads `getText` once, on mount: keyed by language, it starts over per language. */}
            <Editor
              key={code}
              id={`${ids}-message`}
              disableLists
              excludedToolbarItems={BANNER_EXCLUDED_TOOLBAR_ITEMS}
              isExternalUrlsAllowed
              placeholder={defaults.message.map((run) => run.text).join("")}
              getText={() => bannerRunsToHtml(translation.message)}
              setText={(html) => update({ message: bannerHtmlToRuns(html) })}
            />
          </div>
        ) : (
          <EditorField key={field} label={fieldLabels[field]} htmlFor={`${ids}-${field}`}>
            <Input
              id={`${ids}-${field}`}
              dir="auto"
              maxLength={MAX_TEXT_LENGTH}
              placeholder={defaults[field]}
              value={translation[field]}
              onChange={(event) => update({ [field]: event.target.value })}
            />
          </EditorField>
        )
      )}
    </EditorPanel>
  );
};

/**
 * The Language tab (ENG-4003), on every plan: the creative's languages from the workspace's, which are
 * shown to visitors, and their translations. Visitors get the language the site sets, or their
 * browser's when the survey uses it; a missing or hidden translation shows the default language.
 */
export const LanguageTab = ({
  workspaceId,
  form,
  setForm,
  workspaceLanguageCodes,
  survey,
}: Readonly<{
  workspaceId: string;
  form: TCreativeEditorForm;
  setForm: TSetForm;
  /** The workspace's languages a creative can be written in (canonical codes). */
  workspaceLanguageCodes: string[];
  /** The Destination survey picked in the Content tab, if any. */
  survey: TDestinationSurveyOption | null;
}>) => {
  const { t, i18n } = useTranslation();
  const locale = getUiLocale(i18n);
  const { languages } = form;
  const [editingCode, setEditingCode] = useState<string | null>(languages.others[0]?.code ?? null);
  const [removingCode, setRemovingCode] = useState<string | null>(null);
  const nameOf = (code: string) => getLanguageLabel(code, locale) ?? code;
  const setLanguages = (
    update: (current: TCreativeEditorForm["languages"]) => TCreativeEditorForm["languages"]
  ) => setForm((current) => ({ ...current, languages: update(current.languages) }));

  const usedCodes = new Set([languages.defaultLanguage, ...languages.others.map(({ code }) => code)]);
  const addableCodes = workspaceLanguageCodes.filter((code) => !usedCodes.has(code));
  const isEditing = editingCode !== null && languages.others.some(({ code }) => code === editingCode);
  const languagesHref = `/workspaces/${workspaceId}/settings/workspace/languages`;

  const remove = (code: string) => {
    setLanguages((current) => removeCreativeLanguage(current, code));
    if (editingCode === code) setEditingCode(null);
  };

  return (
    <>
      <EditorPanel
        title={t("workspace.creatives.editor.languages_title")}
        icon={LanguagesIcon}
        description={t("workspace.creatives.editor.languages_description")}>
        <SurveyLanguageWarning languages={languages} survey={survey} />
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">{t("common.language")}</th>
                <th className="px-3 py-2 font-medium">{t("workspace.surveys.edit.translated")}</th>
                <th className="px-3 py-2 font-medium">{t("workspace.surveys.edit.visible")}</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2.5">
                  <span className="block font-medium text-slate-800">
                    {nameOf(languages.defaultLanguage)}
                  </span>
                  <span className="text-xs text-slate-500">{languages.defaultLanguage}</span>
                </td>
                <td className="px-3 py-2.5">
                  <Badge type="gray" size="tiny" text={t("common.default")} />
                </td>
                <td className="px-3 py-2.5">
                  <Switch checked disabled aria-label={t("workspace.surveys.edit.visible")} />
                </td>
                <td />
              </tr>
              {languages.others.map(({ code, enabled }) => {
                const { translated, total } = getTranslationProgress(form, code);
                return (
                  <tr
                    key={code}
                    className={cn(
                      "cursor-pointer border-t border-slate-200 hover:bg-slate-50",
                      code === editingCode && "bg-slate-50"
                    )}
                    onClick={() => setEditingCode(code)}>
                    <td className="px-3 py-2.5">
                      <span className="block font-medium text-slate-800">{nameOf(code)}</span>
                      <span className="text-xs text-slate-500">{code}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {translated}/{total}
                    </td>
                    <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                      <Switch
                        checked={enabled}
                        aria-label={t("workspace.surveys.edit.visible")}
                        onCheckedChange={(checked) =>
                          setLanguages((current) => setCreativeLanguageEnabled(current, code, checked))
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="rounded-sm p-1 hover:bg-slate-100"
                            aria-label={t("common.more_options")}>
                            <EllipsisVerticalIcon className="size-4 text-slate-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingCode(code)}>
                            {t("workspace.creatives.editor.edit_translation")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setForm((current) => makeDefaultLanguage(current, code));
                              setEditingCode(languages.defaultLanguage);
                            }}>
                            {t("workspace.surveys.edit.make_default")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => (translated > 0 ? setRemovingCode(code) : remove(code))}>
                            {t("common.remove")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {addableCodes.length > 0 && (
            <Select
              value=""
              onValueChange={(code) => {
                setLanguages((current) => addCreativeLanguage(current, code));
                setEditingCode(code);
              }}>
              <SelectTrigger
                className="w-48 bg-white"
                aria-label={t("workspace.creatives.editor.add_language")}>
                <PlusIcon className="size-4 text-slate-500" aria-hidden="true" />
                <SelectValue placeholder={t("workspace.creatives.editor.add_language")} />
              </SelectTrigger>
              <SelectContent>
                {addableCodes.map((code) => (
                  <SelectItem key={code} value={code}>
                    {nameOf(code)} ({code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button asChild size="sm" variant="secondary">
            <Link href={languagesHref} target="_blank">
              {t("workspace.surveys.edit.manage_languages")}
              <ArrowUpRightIcon />
            </Link>
          </Button>
        </div>
      </EditorPanel>

      {isEditing && editingCode && (
        <TranslationFields
          form={form}
          setForm={setForm}
          code={editingCode}
          languageName={nameOf(editingCode)}
        />
      )}

      <ConfirmationModal
        open={removingCode !== null}
        setOpen={(value) => {
          const open = typeof value === "function" ? value(removingCode !== null) : value;
          if (!open) setRemovingCode(null);
        }}
        title={t("workspace.creatives.editor.remove_language_title", {
          language: removingCode ? nameOf(removingCode) : "",
        })}
        body={t("workspace.creatives.editor.remove_language_body")}
        buttonText={t("common.remove")}
        buttonVariant="destructive"
        onConfirm={() => {
          if (removingCode) remove(removingCode);
          setRemovingCode(null);
        }}
      />
    </>
  );
};
