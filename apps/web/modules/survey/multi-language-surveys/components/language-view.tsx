"use client";

import { Language } from "@prisma/client";
import { ArrowUpRight, EllipsisVerticalIcon } from "lucide-react";
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
  removeLanguageKeysFromSurvey,
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

  const translatableStrings = useMemo(() => extractTranslatableStrings(localSurvey, t), [localSurvey, t]);

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

  const handleToggleLanguage = (code: string) => {
    const surveyLang = localSurvey.languages.find((l) => l.language.code === code);

    if (surveyLang) {
      if (surveyLang.enabled) {
        // Disabling
        const progress = computeTranslationProgress(translatableStrings, code);
        if (progress.translated > 0) {
          // Has translations — just disable, keep translations in survey object
          const updatedLanguages = localSurvey.languages.map((l) =>
            l.language.code === code ? { ...l, enabled: false } : l
          );
          setLocalSurvey({ ...localSurvey, languages: updatedLanguages });
        } else {
          // No translations — remove from survey object and clean up i18n keys
          const cleanedSurvey = removeLanguageKeysFromSurvey(localSurvey, code);
          const updatedLanguages = localSurvey.languages.filter((l) => l.language.code !== code);
          setLocalSurvey({ ...cleanedSurvey, languages: updatedLanguages });
        }
      } else {
        // Re-enabling — ensure i18n keys exist for any new translatable strings
        const updatedLanguages = localSurvey.languages.map((l) =>
          l.language.code === code ? { ...l, enabled: true } : l
        );
        updateSurveyTranslations(localSurvey, updatedLanguages);
      }
    } else {
      // Language not in survey — add it with enabled: true
      const language = projectLanguages.find((l) => l.code === code);
      if (language) {
        const updatedLanguages: TSurveyLanguage[] = [
          ...localSurvey.languages,
          { enabled: true, default: false, language },
        ];
        updateSurveyTranslations(localSurvey, updatedLanguages);
      }
    }
  };

  const handleRemoveTranslations = (code: string) => {
    const label = getLanguageLabel(code, locale) ?? code;
    setConfirmationModalInfo({
      open: true,
      title: `${t("environments.surveys.edit.remove_translations")}: ${label}`,
      body: t("environments.surveys.edit.this_will_remove_the_language_and_all_its_translations"),
      buttonText: t("environments.surveys.edit.remove_translations"),
      buttonVariant: "destructive",
      onConfirm: () => {
        const cleanedSurvey = removeLanguageKeysFromSurvey(localSurvey, code);
        const updatedLanguages = localSurvey.languages.filter((l) => l.language.code !== code);
        setLocalSurvey({ ...cleanedSurvey, languages: updatedLanguages });
        setConfirmationModalInfo((prev) => ({ ...prev, open: false }));
      },
    });
  };

  const handleChangeDefault = () => {
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
  };

  const handleLanguageSwitchToggle = () => {
    setLocalSurvey({ ...localSurvey, showLanguageSwitch: !localSurvey.showLanguageSwitch });
  };

  const openTranslationModal = (code: string) => {
    setActiveLanguageCode(code);
    setTranslationModalOpen(true);
  };

  return (
    <div className="mt-12 space-y-3 p-5">
      {/* Activation toggle — only show when workspace has languages */}
      {projectLanguages.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg border border-slate-300 bg-white p-4">
          <Switch
            checked={isMultiLanguageActivated}
            onCheckedChange={handleActivationSwitch}
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
      )}

      {isMultiLanguageActivated && (
        <div className="space-y-6 rounded-lg border border-slate-300 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">{t("common.survey_languages")}</h3>
          </div>

          {/* Default language select — only show when no default is set yet */}
          {projectLanguages.length > 0 && !defaultLanguage && (
            <div className="space-y-2">
              <Label>{t("environments.surveys.edit.default_language")}</Label>
              <div className="w-56">
                <Select
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
                    <SelectValue placeholder={t("common.select_language")} />
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
            </div>
          )}

          {/* Languages table — show all workspace languages */}
          {defaultLanguage && projectLanguages.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-300">
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
                      {t("environments.surveys.edit.visible")}
                    </th>
                    <th className="w-12 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {/* Default language row */}
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {getLanguageLabel(defaultLanguage.code, locale)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{defaultLanguage.code}</td>
                    <td className="px-4 py-3">
                      <Badge type="gray" size="normal" text={t("common.default")} />
                    </td>
                    <td className="px-4 py-3">
                      <Switch checked disabled />
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="rounded p-1 hover:bg-slate-100">
                            <EllipsisVerticalIcon className="h-4 w-4 text-slate-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={handleChangeDefault}>
                            {t("environments.surveys.edit.change_default")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>

                  {/* Non-default language rows — all workspace languages except default */}
                  {projectLanguages
                    .filter((pl) => pl.code !== defaultLanguage.code)
                    .map((pl) => {
                      const surveyLang = localSurvey.languages.find((sl) => sl.language.code === pl.code);
                      const inSurvey = !!surveyLang;
                      const enabled = surveyLang?.enabled ?? false;
                      const progress = inSurvey
                        ? computeTranslationProgress(translatableStrings, pl.code)
                        : null;

                      return (
                        <tr
                          key={pl.code}
                          className={cn(
                            "border-t border-slate-200",
                            inSurvey && "cursor-pointer hover:bg-slate-50"
                          )}
                          onClick={() => {
                            if (inSurvey) {
                              openTranslationModal(pl.code);
                            }
                          }}>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {getLanguageLabel(pl.code, locale)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{pl.code}</td>
                          <td className="px-4 py-3">
                            {inSurvey && progress && (
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
                            <Switch checked={enabled} onCheckedChange={() => handleToggleLanguage(pl.code)} />
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {inSurvey && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button type="button" className="rounded p-1 hover:bg-slate-100">
                                    <EllipsisVerticalIcon className="h-4 w-4 text-slate-500" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openTranslationModal(pl.code)}>
                                    {t("environments.surveys.edit.manage_translations")}
                                  </DropdownMenuItem>
                                  {progress && progress.translated > 0 && (
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-600"
                                      onClick={() => handleRemoveTranslations(pl.code)}>
                                      {t("environments.surveys.edit.remove_translations")}
                                    </DropdownMenuItem>
                                  )}
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

          {/* Manage workspace languages link */}
          <Button asChild size="sm" variant="secondary">
            <Link href={`/environments/${environmentId}/workspace/languages`} target="_blank">
              {t("environments.surveys.edit.manage_languages")}
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>

          {/* Show language switcher toggle */}
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
        </div>
      )}

      {projectLanguages.length === 0 && (
        <div className="rounded-lg border border-slate-300 bg-white p-6 text-center">
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
