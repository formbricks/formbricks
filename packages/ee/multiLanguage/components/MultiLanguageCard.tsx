"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ArrowUpRight, Languages } from "lucide-react";
import { FC, useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { TLanguage, TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyLanguage } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import ConfirmationModal from "@formbricks/ui/ConfirmationModal";
import DefaultTag from "@formbricks/ui/DefaultTag";
import { Label } from "@formbricks/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui/Select";
import { Switch } from "@formbricks/ui/Switch";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";

import { getLanguageLabel } from "../lib/isoLanguages";

interface HiddenFieldsCardProps {
  localSurvey: TSurvey;
  product: TProduct;
  setLocalSurvey: (survey: TSurvey) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
  isMultiLanguageAllowed?: boolean;
  isFormbricksCloud: boolean;
  setSelectedLanguageCode: (language: string) => void;
}

const MultiLanguageCard: FC<HiddenFieldsCardProps> = ({
  activeQuestionId,
  product,
  localSurvey,
  setActiveQuestionId,
  setLocalSurvey,
  isMultiLanguageAllowed,
  isFormbricksCloud,
  setSelectedLanguageCode,
}) => {
  const environmentId = localSurvey.environmentId;
  const open = activeQuestionId == "multiLanguage";
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [isMultiLanguageActivated, setIsMultiLanguageActivated] = useState(
    localSurvey.languages ? localSurvey.languages.length > 1 : false
  );
  const [openRemoveTranslationModal, setOpenRemoveTranslationModal] = useState(false);
  const surveyLanguageCodes =
    localSurvey.languages?.map((surveyLanguage) => surveyLanguage.language.code) ?? [];
  const [defaultLanguage, setDefaultLanguage] = useState(
    localSurvey.languages?.find((language) => {
      return language.default === true;
    })?.language
  );
  const [defaultLanguageCodeTemp, setdefaultLanguageCodeTemp] = useState("");

  const setOpen = (open: boolean) => {
    if (open) {
      setActiveQuestionId("multiLanguage");
    } else {
      setActiveQuestionId(null);
    }
  };

  const updateSurveyLanguages = (language: TLanguage) => {
    const newLanguages = localSurvey.languages?.filter((lang) => lang.language.code !== language.code) ?? [];
    if (!surveyLanguageCodes.includes(language.code)) {
      newLanguages.push({ enabled: true, default: false, language });
    }
    updateSurvey({ languages: newLanguages });
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
        localSurvey.languages?.map((lang) => {
          if (lang.language.code === language.code) {
            languageExists = true;
            return { ...lang, default: true };
          } else {
            return { ...lang, default: false };
          }
        }) ?? [];

      if (!languageExists) {
        // If the language doesn't exist, add it as the default
        newLanguages.push({ enabled: true, default: true, language });
      }

      setDefaultLanguage(language);
      setIsConfirmationModalOpen(false);
      updateSurvey({ languages: newLanguages });
    }
  };

  const handleActivationSwitchLogic = () => {
    if (isMultiLanguageActivated) {
      if (localSurvey.languages?.length > 0) {
        setOpenRemoveTranslationModal(true);
      } else {
        setIsMultiLanguageActivated(false);
      }
      return;
    } else {
      setIsMultiLanguageActivated(true);
    }
  };

  return (
    <div
      className={cn(
        open ? "scale-100 shadow-lg " : "scale-97 shadow-md",
        "group z-10 flex flex-row rounded-lg bg-white transition-transform duration-300 ease-in-out"
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
        open={open}
        onOpenChange={setOpen}
        className="flex-1 rounded-r-lg border border-slate-200 transition-all duration-300 ease-in-out">
        <Collapsible.CollapsibleTrigger
          asChild
          className="flex cursor-pointer justify-between p-4 hover:bg-slate-50">
          <div>
            <div className="inline-flex">
              <div>
                <p className="text-sm font-semibold">Multiple Languages</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Label htmlFor="multi-lang-toggle">{isMultiLanguageActivated ? "On" : "Off"}</Label>

              <Switch
                id="multi-lang-toggle"
                checked={isMultiLanguageActivated}
                onClick={(e) => {
                  e.stopPropagation();
                  handleActivationSwitchLogic();
                }}
                disabled={!isMultiLanguageAllowed || product.languages.length === 0}
              />
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="px-4 pb-6">
          <div className="space-y-4">
            {product.languages.length === 0 && (
              <p className="mt-2 text-sm italic text-slate-500">
                No languages found. Add the first one to get started:
              </p>
            )}
            {product.languages.length === 1 && (
              <div className="text-sm">You need two or more languages to work with translations.</div>
            )}
            {product.languages.length > 1 && (
              <div className="my-4 space-y-4">
                <div>
                  {!isMultiLanguageAllowed &&
                    (!isFormbricksCloud ? (
                      <UpgradePlanNotice
                        message="To enable multi-language surveys,"
                        url={`/environments/${environmentId}/settings/billing`}
                        textForUrl="please add your credit card (free)."
                      />
                    ) : (
                      <UpgradePlanNotice
                        message="To enable multi-language surveys,"
                        url="https://formbricks.com/docs/self-hosting/enterprise"
                        textForUrl="get a self-hosting license (free)."
                      />
                    ))}
                </div>
                {isMultiLanguageActivated && (
                  <div className="space-y-4">
                    <div className="space-y-4">
                      <p className="text-sm">1. Choose the default language for this survey</p>
                      <div className="flex items-center space-x-4">
                        <div className=" w-48 ">
                          <Select
                            value={`${defaultLanguage?.code}`}
                            defaultValue={`${defaultLanguage?.code}`}
                            disabled={defaultLanguage ? true : false}
                            onValueChange={(languageCode) => {
                              setdefaultLanguageCodeTemp(languageCode);
                              setIsConfirmationModalOpen(true);
                            }}>
                            <SelectTrigger className="xs:w-[180px] xs:text-base w-full px-4 text-xs text-slate-800 dark:border-slate-400 dark:bg-slate-700 dark:text-slate-300">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {product.languages.map((language) => (
                                <SelectItem
                                  key={language.id}
                                  className="xs:text-base px-0.5 py-1 text-xs text-slate-800 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-700"
                                  value={language.code}>
                                  {`${getLanguageLabel(language.code)} (${language.code})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <ConfirmationModal
                            open={isConfirmationModalOpen}
                            setOpen={setIsConfirmationModalOpen}
                            title={`Save ${getLanguageLabel(defaultLanguageCodeTemp)} as default language`}
                            text={`Once set, default value cannot be change untill you re-enable translations, are you sure?`}
                            buttonText="Save default language"
                            onConfirm={() => handleDefaultLanguageChange(defaultLanguageCodeTemp)}
                          />
                        </div>
                        <DefaultTag />
                      </div>
                    </div>

                    {defaultLanguage && (
                      <div className="space-y-4">
                        <p className="text-sm">2. Activate translation for specific languages</p>
                        <div>
                          <div className="flex flex-col space-y-4">
                            {product.languages.map((language) => {
                              if (language.id === defaultLanguage.id) return;
                              return (
                                <div className="flex items-center space-x-4">
                                  <Switch
                                    id="hidden-fields-toggle"
                                    checked={surveyLanguageCodes.includes(language.code)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateSurveyLanguages(language);
                                    }}
                                  />
                                  <Label htmlFor="hidden-fields-toggle" className="font-bold">
                                    {getLanguageLabel(language.code)}
                                  </Label>
                                  {surveyLanguageCodes.includes(language.code) && (
                                    <p
                                      className="cursor-pointer text-xs underline"
                                      onClick={() => {
                                        setSelectedLanguageCode(language.code);
                                        setActiveQuestionId(localSurvey.questions[0]?.id);
                                      }}>
                                      Edit {getLanguageLabel(language.code)} translations
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <Button
              className="mt-4"
              variant="secondary"
              href={`/environments/${environmentId}/settings/language`}
              target="_blank">
              Add Language <ArrowUpRight className="ml-2 h-5 w-5" />
            </Button>
            <ConfirmationModal
              title={"Disable translations"}
              open={openRemoveTranslationModal}
              setOpen={setOpenRemoveTranslationModal}
              text={"This action will remove all the translations from this survey. Are you sure?"}
              onConfirm={() => {
                setLocalSurvey({ ...localSurvey, languages: [] });
                setOpenRemoveTranslationModal(false);
                setIsMultiLanguageActivated(false);
                setDefaultLanguage(undefined);
              }}
              buttonText="Confirm"
            />
          </div>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};

export default MultiLanguageCard;
