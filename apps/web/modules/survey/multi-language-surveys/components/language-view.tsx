"use client";

import { Language } from "@prisma/client";
import { ArrowUpRight, EllipsisVerticalIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import { addMultiLanguageLabels, extractLanguageCodes, getEnabledLanguages } from "@/lib/i18n/utils";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import {
  computeTranslationProgress,
  extractTranslatableStrings,
  getProgressColor,
  getProgressTextColor,
} from "../lib/utils";
import { ManageTranslationsModal } from "./manage-translations-modal";

interface LanguageViewProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  projectLanguages: Language[];
  locale: TUserLocale;
  setHasIncompleteTranslations: (has: boolean) => void;
}

interface ConfirmationModalInfo {
  title: string;
  open: boolean;
  body: string;
  buttonText: string;
  buttonVariant?: "default" | "destructive";
  onConfirm: () => void;
}

export const LanguageView = ({
  localSurvey,
  setLocalSurvey,
  projectLanguages,
  locale,
  setHasIncompleteTranslations,
}: LanguageViewProps) => {
  const { t } = useTranslation();
  const environmentId = localSurvey.environmentId;

  const [isMultiLanguageActivated, setIsMultiLanguageActivated] = useState(localSurvey.languages.length > 0);
  const [confirmationModalInfo, setConfirmationModalInfo] = useState<ConfirmationModalInfo>({
    title: "",
    open: false,
    body: "",
    buttonText: "",
    onConfirm: () => {},
  });
  const [translationModalOpen, setTranslationModalOpen] = useState(false);
  const [activeLanguageCode, setActiveLanguageCode] = useState<string>("");

  const defaultLanguage = useMemo(
    () => localSurvey.languages.find((l) => l.default)?.language,
    [localSurvey.languages]
  );

  const translatableStrings = useMemo(() => extractTranslatableStrings(localSurvey), [localSurvey]);

  const enabledLanguages = getEnabledLanguages(localSurvey.languages);

  // Sync multi-language state
  useEffect(() => {
    if (localSurvey.languages.length === 0) {
      setIsMultiLanguageActivated(false);
    }
  }, [localSurvey.languages]);

  // Track incomplete translations
  useEffect(() => {
    if (!isMultiLanguageActivated || localSurvey.languages.length <= 1) {
      setHasIncompleteTranslations(false);
      return;
    }
    const nonDefaultLangs = localSurvey.languages.filter((l) => !l.default && l.enabled);
    const hasIncomplete = nonDefaultLangs.some((lang) => {
      const progress = computeTranslationProgress(translatableStrings, lang.language.code);
      return progress.percentage < 100;
    });
    setHasIncompleteTranslations(hasIncomplete);
  }, [localSurvey.languages, translatableStrings, isMultiLanguageActivated, setHasIncompleteTranslations]);

  const updateSurveyTranslations = (survey: TSurvey, updatedLanguages: TSurveyLanguage[]) => {
    const translatedSurveyResult = addMultiLanguageLabels(survey, extractLanguageCodes(updatedLanguages));
    const updatedSurvey = { ...translatedSurveyResult, languages: updatedLanguages };
    setLocalSurvey(updatedSurvey as TSurvey);
  };

  const handleActivationSwitch = () => {
    if (isMultiLanguageActivated) {
      if (localSurvey.languages.length > 0) {
        setConfirmationModalInfo({
          open: true,
          title: t("environments.surveys.edit.remove_translations"),
          body: t("environments.surveys.edit.this_action_will_remove_all_the_translations_from_this_survey"),
          buttonText: t("environments.surveys.edit.remove_translations"),
          buttonVariant: "destructive",
          onConfirm: () => {
            updateSurveyTranslations(localSurvey, []);
            setIsMultiLanguageActivated(false);
            setConfirmationModalInfo((prev) => ({ ...prev, open: false }));
          },
        });
      } else {
        setIsMultiLanguageActivated(false);
      }
    } else {
      setIsMultiLanguageActivated(true);
    }
  };

  const handleDefaultLanguageChange = (languageCode: string) => {
    const language = projectLanguages.find((lang) => lang.code === languageCode);
    if (!language) return;

    let languageExists = false;
    const newLanguages =
      localSurvey.languages.map((lang) => {
        if (lang.language.code === language.code) {
          languageExists = true;
          return { ...lang, default: true };
        }
        return { ...lang, default: false };
      }) ?? [];

    if (!languageExists) {
      newLanguages.push({ enabled: true, default: true, language });
    }

    setConfirmationModalInfo((prev) => ({ ...prev, open: false }));
    setLocalSurvey({ ...localSurvey, languages: newLanguages });
  };

  const addLanguage = (language: Language) => {
    const updatedLanguages: TSurveyLanguage[] = [
      ...localSurvey.languages,
      { enabled: true, default: false, language },
    ];
    updateSurveyTranslations(localSurvey, updatedLanguages);
  };

  const toggleLanguageEnabled = (code: string) => {
    const updatedLanguages = localSurvey.languages.map((lang) =>
      lang.language.code === code ? { ...lang, enabled: !lang.enabled } : lang
    );
    updateSurveyTranslations(localSurvey, updatedLanguages);
  };

  const removeLanguage = (code: string) => {
    const updatedLanguages = localSurvey.languages.filter((lang) => lang.language.code !== code);
    updateSurveyTranslations(localSurvey, updatedLanguages);
  };

  const confirmRemoveLanguage = (code: string) => {
    const label = getLanguageLabel(code, locale) ?? code;
    setConfirmationModalInfo({
      open: true,
      title: `${t("environments.workspace.languages.remove_language")}: ${label}`,
      body: t("environments.surveys.edit.this_will_remove_the_language_and_all_its_translations"),
      buttonText: t("common.remove"),
      buttonVariant: "destructive",
      onConfirm: () => {
        removeLanguage(code);
        setConfirmationModalInfo((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleLanguageSwitchToggle = () => {
    setLocalSurvey({ ...localSurvey, showLanguageSwitch: !localSurvey.showLanguageSwitch });
  };

  const openTranslationModal = (code: string) => {
    setActiveLanguageCode(code);
    setTranslationModalOpen(true);
  };

  // Languages not yet added to the survey
  const availableLanguages = projectLanguages.filter(
    (pl) => !localSurvey.languages.some((sl) => sl.language.code === pl.code)
  );

  return (
    <div className="mt-12 space-y-6 p-5">
      {/* Activation toggle */}
      <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <Switch
          checked={isMultiLanguageActivated}
          onCheckedChange={handleActivationSwitch}
          disabled={projectLanguages.length === 0}
          id="activate-translations-toggle"
        />
        <div>
          <Label htmlFor="activate-translations-toggle" className="text-base font-semibold text-slate-900">
            {t("environments.surveys.edit.activate_translations")}
          </Label>
          <p className="text-sm text-slate-500">
            {t("environments.surveys.edit.present_your_survey_in_multiple_languages")}
          </p>
        </div>
      </div>

      {isMultiLanguageActivated && (
        <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              {t("environments.surveys.edit.survey_language")}
            </h3>
          </div>

          {/* Default language select */}
          {projectLanguages.length > 0 && (
            <div className="space-y-2">
              <Label>{t("environments.surveys.edit.default_language")}</Label>
              <div className="flex items-center gap-2">
                <div className="w-56">
                  <Select
                    value={defaultLanguage?.code}
                    disabled={Boolean(defaultLanguage)}
                    onValueChange={(code) => {
                      setConfirmationModalInfo({
                        open: true,
                        title:
                          t("environments.surveys.edit.confirm_default_language") +
                          ": " +
                          getLanguageLabel(code, locale),
                        body: t(
                          "environments.surveys.edit.once_set_the_default_language_for_this_survey_can_only_be_changed_by_disabling_the_multi_language_option_and_deleting_all_translations"
                        ),
                        buttonText: t("common.confirm"),
                        buttonVariant: "default",
                        onConfirm: () => handleDefaultLanguageChange(code),
                      });
                    }}>
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projectLanguages.map((lang) => (
                        <SelectItem key={lang.id} value={lang.code}>
                          {getLanguageLabel(lang.code, locale)} ({lang.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {defaultLanguage && <Badge type="gray" size="normal" text={t("common.default")} />}
              </div>
            </div>
          )}

          {/* Languages table */}
          {defaultLanguage && localSurvey.languages.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                      {t("common.language")}
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                      {t("environments.surveys.edit.code")}
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                      {t("environments.surveys.edit.translated")}
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                      {t("environments.surveys.edit.enabled")}
                    </th>
                    <th className="w-12 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {localSurvey.languages.map((surveyLang) => {
                    const isDefault = surveyLang.default;
                    const lang = surveyLang.language;
                    const progress = isDefault
                      ? null
                      : computeTranslationProgress(translatableStrings, lang.code);

                    return (
                      <tr
                        key={lang.code}
                        className={cn(
                          "border-t border-slate-200",
                          !isDefault && "cursor-pointer hover:bg-slate-50"
                        )}
                        onClick={() => {
                          if (!isDefault) {
                            openTranslationModal(lang.code);
                          }
                        }}>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {getLanguageLabel(lang.code, locale)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{lang.code}</td>
                        <td className="px-4 py-3">
                          {isDefault && <Badge type="gray" size="normal" text={t("common.default")} />}
                          {!isDefault && progress && (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    getProgressColor(progress.percentage)
                                  )}
                                  style={{ width: `${progress.percentage}%` }}
                                />
                              </div>
                              <span
                                className={cn(
                                  "text-xs font-medium",
                                  getProgressTextColor(progress.percentage)
                                )}>
                                {progress.translated}/{progress.total}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {isDefault ? (
                            <Switch checked disabled />
                          ) : (
                            <Switch
                              checked={surveyLang.enabled}
                              onCheckedChange={() => toggleLanguageEnabled(lang.code)}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {!isDefault && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className="rounded p-1 hover:bg-slate-100">
                                  <EllipsisVerticalIcon className="h-4 w-4 text-slate-500" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openTranslationModal(lang.code)}>
                                  {t("environments.surveys.edit.manage_translations")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => confirmRemoveLanguage(lang.code)}>
                                  {t("common.remove")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Add language button */}
          {defaultLanguage && availableLanguages.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  <PlusIcon className="mr-1 h-4 w-4" />
                  {t("environments.surveys.edit.add_language")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {availableLanguages.map((lang) => (
                  <DropdownMenuItem key={lang.id} onClick={() => addLanguage(lang)}>
                    {getLanguageLabel(lang.code, locale)} ({lang.code})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Show language switcher toggle */}
          {isMultiLanguageActivated && (
            <AdvancedOptionToggle
              customContainerClass="px-0 pt-0"
              htmlId="languageSwitch"
              disabled={enabledLanguages.length <= 1}
              isChecked={!!localSurvey.showLanguageSwitch}
              onToggle={handleLanguageSwitchToggle}
              title={t("environments.surveys.edit.show_language_switch")}
              description={t(
                "environments.surveys.edit.enable_participants_to_switch_the_survey_language_at_any_point_during_the_survey"
              )}
              childBorder={true}
            />
          )}

          {/* Manage workspace languages link */}
          <Button asChild size="sm" variant="secondary">
            <Link href={`/environments/${environmentId}/workspace/languages`} target="_blank">
              {t("environments.surveys.edit.manage_languages")}
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      {!isMultiLanguageActivated && projectLanguages.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-500">
            {t("environments.surveys.edit.no_languages_found_add_first_one_to_get_started")}
          </p>
          <Button asChild size="sm" variant="secondary" className="mt-3">
            <Link href={`/environments/${environmentId}/workspace/languages`} target="_blank">
              {t("environments.surveys.edit.manage_languages")}
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      {/* Confirmation modal */}
      <ConfirmationModal
        buttonText={confirmationModalInfo.buttonText}
        buttonVariant={confirmationModalInfo.buttonVariant}
        onConfirm={confirmationModalInfo.onConfirm}
        open={confirmationModalInfo.open}
        setOpen={(value) => {
          const open = typeof value === "function" ? value(confirmationModalInfo.open) : value;
          setConfirmationModalInfo((prev) => ({ ...prev, open }));
        }}
        body={confirmationModalInfo.body}
        title={confirmationModalInfo.title}
      />

      {/* Translations modal */}
      <ManageTranslationsModal
        open={translationModalOpen}
        setOpen={setTranslationModalOpen}
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        languageCode={activeLanguageCode}
        languageName={getLanguageLabel(activeLanguageCode, locale) ?? activeLanguageCode}
        defaultLanguageName={
          defaultLanguage ? (getLanguageLabel(defaultLanguage.code, locale) ?? defaultLanguage.code) : ""
        }
      />
    </div>
  );
};
