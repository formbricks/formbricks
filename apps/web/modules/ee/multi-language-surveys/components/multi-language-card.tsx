"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ArrowUpRight, Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { addMultiLanguageLabels, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import type { TLanguage, TProject } from "@formbricks/types/project";
import type { TSurvey, TSurveyLanguage, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { AdvancedOptionToggle } from "@formbricks/ui/components/AdvancedOptionToggle";
import { Button } from "@formbricks/ui/components/Button";
import { ConfirmationModal } from "@formbricks/ui/components/ConfirmationModal";
import { Label } from "@formbricks/ui/components/Label";
import { Switch } from "@formbricks/ui/components/Switch";
import { UpgradePlanNotice } from "@formbricks/ui/components/UpgradePlanNotice";
import { DefaultLanguageSelect } from "./default-language-select";
import { SecondaryLanguageSelect } from "./secondary-language-select";

interface MultiLanguageCardProps {
  localSurvey: TSurvey;
  product: TProject;
  setLocalSurvey: (survey: TSurvey) => void;
  activeQuestionId: TSurveyQuestionId | null;
  setActiveQuestionId: (questionId: TSurveyQuestionId | null) => void;
  isMultiLanguageAllowed?: boolean;
  isFormbricksCloud: boolean;
  setSelectedLanguageCode: (language: string) => void;
  locale: TUserLocale;
}

export interface ConfirmationModalProps {
  text: string;
  open: boolean;
  title: string;
  buttonText: string;
  buttonVariant?: "primary" | "warn";
  onConfirm: () => void;
}

export const MultiLanguageCard: FC<MultiLanguageCardProps> = ({
  activeQuestionId,
  product,
  localSurvey,
  setActiveQuestionId,
  setLocalSurvey,
  isMultiLanguageAllowed,
  isFormbricksCloud,
  setSelectedLanguageCode,
  locale,
}) => {
  const t = useTranslations();
  const environmentId = localSurvey.environmentId;
  const open = activeQuestionId === "multiLanguage";
  const [isMultiLanguageActivated, setIsMultiLanguageActivated] = useState(localSurvey.languages.length > 1);
  const [confirmationModalInfo, setConfirmationModalInfo] = useState<ConfirmationModalProps>({
    title: "",
    open: false,
    text: "",
    buttonText: "",
    onConfirm: () => { },
  });

  const defaultLanguage = useMemo(
    () => localSurvey.languages.find((language) => language.default)?.language,
    [localSurvey.languages]
  );

  const setOpen = (open: boolean) => {
    if (open) {
      setActiveQuestionId("multiLanguage");
    } else {
      setActiveQuestionId(null);
    }
  };

  useEffect(() => {
    if (localSurvey.languages.length === 0) {
      setIsMultiLanguageActivated(false);
    }
  }, [localSurvey.languages]);

  const updateSurveyTranslations = (survey: TSurvey, updatedLanguages: TSurveyLanguage[]) => {
    const translatedSurveyResult = addMultiLanguageLabels(survey, extractLanguageCodes(updatedLanguages));

    const updatedSurvey = { ...translatedSurveyResult, languages: updatedLanguages };
    setLocalSurvey(updatedSurvey as TSurvey);
  };

  const updateSurveyLanguages = (language: TLanguage) => {
    let updatedLanguages = localSurvey.languages;
    const languageIndex = localSurvey.languages.findIndex(
      (surveyLanguage) => surveyLanguage.language.code === language.code
    );
    if (languageIndex >= 0) {
      // Toggle the 'enabled' property of the existing language
      updatedLanguages = updatedLanguages.map((surveyLanguage, index) =>
        index === languageIndex ? { ...surveyLanguage, enabled: !surveyLanguage.enabled } : surveyLanguage
      );
    } else {
      // Add the new language
      updatedLanguages = [
        ...updatedLanguages,
        {
          enabled: true,
          default: false,
          language,
        },
      ];
    }
    updateSurveyTranslations(localSurvey, updatedLanguages);
  };

  const updateSurvey = (data: { languages: TSurveyLanguage[] }) => {
    setLocalSurvey({ ...localSurvey, ...data });
  };

  const handleDefaultLanguageChange = (languageCode: string) => {
    const language = product.languages.find((lang) => lang.code === languageCode);
    if (language) {
      let languageExists = false;

      // Update all languages and check if the new default language already exists
      const newLanguages =
        localSurvey.languages.map((lang) => {
          if (lang.language.code === language.code) {
            languageExists = true;
            return { ...lang, default: true };
          }
          return { ...lang, default: false };
        }) ?? [];

      if (!languageExists) {
        // If the language doesn't exist, add it as the default
        newLanguages.push({
          enabled: true,
          default: true,
          language,
        });
      }

      setConfirmationModalInfo({ ...confirmationModalInfo, open: false });
      updateSurvey({ languages: newLanguages });
    }
  };

  const handleActivationSwitchLogic = () => {
    if (isMultiLanguageActivated) {
      if (localSurvey.languages.length > 0) {
        setConfirmationModalInfo({
          open: true,
          title: t("environments.surveys.edit.remove_translations"),
          text: t("environments.surveys.edit.this_action_will_remove_all_the_translations_from_this_survey"),
          buttonText: t("environments.surveys.edit.remove_translations"),
          buttonVariant: "warn",
          onConfirm: () => {
            updateSurveyTranslations(localSurvey, []);
            setIsMultiLanguageActivated(false);
            setConfirmationModalInfo({ ...confirmationModalInfo, open: false });
          },
        });
      } else {
        setIsMultiLanguageActivated(false);
      }
    } else {
      setIsMultiLanguageActivated(true);
    }
  };

  const handleLanguageSwitchToggle = () => {
    setLocalSurvey({ ...localSurvey, ...{ showLanguageSwitch: !localSurvey.showLanguageSwitch } });
  };

  const [parent] = useAutoAnimate();

  return (
    <div
      className={cn(
        open ? "shadow-lg" : "shadow-md",
        "group z-10 flex flex-row rounded-lg bg-white text-slate-900"
      )}>
      <div
        className={cn(
          open ? "bg-slate-50" : "bg-white group-hover:bg-slate-50",
          "flex w-10 items-center justify-center rounded-l-lg border-b border-l border-t group-aria-expanded:rounded-bl-none"
        )}>
        <p>
          <Languages className="h-6 w-6 rounded-full bg-indigo-500 p-1 text-white" />
        </p>
      </div>
      <Collapsible.Root
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out"
        onOpenChange={setOpen}
        open={open}>
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between rounded-r-lg p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">{t("common.multiple_languages")}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Label htmlFor="multi-lang-toggle">
                {isMultiLanguageActivated ? t("common.on") : t("common.off")}
              </Label>

              <Switch
                checked={isMultiLanguageActivated}
                disabled={!isMultiLanguageAllowed || product.languages.length === 0}
                id="multi-lang-toggle"
                onClick={() => {
                  handleActivationSwitchLogic();
                }}
              />
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className={`flex flex-col px-4 ${open && "pb-6"}`} ref={parent}>
          <div className="space-y-4">
            {!isMultiLanguageAllowed && !isFormbricksCloud && !isMultiLanguageActivated ? (
              <UpgradePlanNotice
                message={t("environments.surveys.edit.to_enable_multi_language_surveys_you_need_an_active")}
                textForUrl={t("common.enterprise_license")}
                url={`/environments/${environmentId}/settings/enterprise`}
              />
            ) : !isMultiLanguageAllowed && isFormbricksCloud && !isMultiLanguageActivated ? (
              <UpgradePlanNotice
                message={t("environments.surveys.edit.to_enable_multi_language_surveys_you_need_an_active")}
                textForUrl={t("common.enterprise_license")}
                url={`/environments/${environmentId}/settings/billing`}
              />
            ) : (
              <>
                {product.languages.length <= 1 && (
                  <div className="mb-4 text-sm italic text-slate-500">
                    {product.languages.length === 0
                      ? t("environments.surveys.edit.no_languages_found_add_first_one_to_get_started")
                      : t(
                        "environments.surveys.edit.you_need_to_have_two_or_more_languages_set_up_in_your_product_to_work_with_translations"
                      )}
                  </div>
                )}
                {product.languages.length > 1 && (
                  <div className="my-4 space-y-4">
                    <div>
                      {isMultiLanguageAllowed && !isMultiLanguageActivated ? (
                        <div className="text-sm italic text-slate-500">
                          {t("environments.surveys.edit.switch_multi_lanugage_on_to_get_started")}
                        </div>
                      ) : null}
                    </div>

                    {isMultiLanguageActivated ? (
                      <div className="space-y-4">
                        <DefaultLanguageSelect
                          defaultLanguage={defaultLanguage}
                          handleDefaultLanguageChange={handleDefaultLanguageChange}
                          product={product}
                          setConfirmationModalInfo={setConfirmationModalInfo}
                          locale={locale}
                        />
                        {defaultLanguage ? (
                          <SecondaryLanguageSelect
                            defaultLanguage={defaultLanguage}
                            localSurvey={localSurvey}
                            product={product}
                            setActiveQuestionId={setActiveQuestionId}
                            setSelectedLanguageCode={setSelectedLanguageCode}
                            updateSurveyLanguages={updateSurveyLanguages}
                            locale={locale}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}

                <Link href={`/environments/${environmentId}/product/languages`} target="_blank">
                  <Button className="mt-2" size="sm" variant="secondary">
                    {t("environments.surveys.edit.manage_languages")}{" "}
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                {isMultiLanguageActivated && (
                  <AdvancedOptionToggle
                    customContainerClass="px-0 pt-2"
                    htmlId="languageSwitch"
                    isChecked={!!localSurvey.showLanguageSwitch}
                    onToggle={handleLanguageSwitchToggle}
                    title={t("environments.surveys.edit.show_language_switch")}
                    description={t(
                      "environments.surveys.edit.enable_participants_to_switch_the_survey_language_at_any_point_during_the_survey"
                    )}
                    childBorder={true}></AdvancedOptionToggle>
                )}
              </>
            )}

            <ConfirmationModal
              buttonText={confirmationModalInfo.buttonText}
              buttonVariant={confirmationModalInfo.buttonVariant}
              onConfirm={confirmationModalInfo.onConfirm}
              open={confirmationModalInfo.open}
              setOpen={() => {
                setConfirmationModalInfo((prev) => ({ ...prev, open: !prev.open }));
              }}
              text={confirmationModalInfo.text}
              title={confirmationModalInfo.title}
            />
          </div>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};
