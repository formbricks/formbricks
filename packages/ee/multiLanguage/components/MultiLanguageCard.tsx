"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ArrowUpRight, Languages } from "lucide-react";
import Link from "next/link";
import { FC, useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { TLanguage, TProduct } from "@formbricks/types/product";
import { TSurvey, TSurveyLanguage } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { ConfirmationModal } from "@formbricks/ui/ConfirmationModal";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";

import { DefaultLanguageSelect } from "./DefaultLanguageSelect";
import { SecondaryLanguageSelect } from "./SecondaryLanguageSelect";

interface MultiLanguageCardProps {
  localSurvey: TSurvey;
  product: TProduct;
  setLocalSurvey: (survey: TSurvey) => void;
  activeQuestionId: string | null;
  setActiveQuestionId: (questionId: string | null) => void;
  isMultiLanguageAllowed?: boolean;
  isFormbricksCloud: boolean;
  setSelectedLanguageCode: (language: string) => void;
}

export interface ConfirmationModalProps {
  text: string;
  open: boolean;
  title: string;
  buttonText: string;
  buttonVariant?: "darkCTA" | "warn";
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
}) => {
  const environmentId = localSurvey.environmentId;
  const open = activeQuestionId == "multiLanguage";
  const [isMultiLanguageActivated, setIsMultiLanguageActivated] = useState(localSurvey.languages?.length > 1);
  const [confirmationModalInfo, setConfirmationModalInfo] = useState<ConfirmationModalProps>({
    title: "",
    open: false,
    text: "",
    buttonText: "",
    onConfirm: () => {},
  });

  const [defaultLanguage, setDefaultLanguage] = useState(
    localSurvey.languages?.find((language) => {
      return language.default === true;
    })?.language
  );

  const setOpen = (open: boolean) => {
    if (open) {
      setActiveQuestionId("multiLanguage");
    } else {
      setActiveQuestionId(null);
    }
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
      updatedLanguages = [...updatedLanguages, { enabled: true, default: false, language }];
    }
    updateSurvey({ languages: updatedLanguages });
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
      setConfirmationModalInfo({ ...confirmationModalInfo, open: false });
      updateSurvey({ languages: newLanguages });
    }
  };

  const handleActivationSwitchLogic = () => {
    if (isMultiLanguageActivated) {
      if (localSurvey.languages?.length > 0) {
        setConfirmationModalInfo({
          open: true,
          title: "Remove translations",
          text: "This action will remove all the translations from this survey.",
          buttonText: "Remove translations",
          buttonVariant: "warn",
          onConfirm: () => {
            setLocalSurvey({ ...localSurvey, languages: [] });
            setIsMultiLanguageActivated(false);
            setDefaultLanguage(undefined);
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

  return (
    <div
      className={cn(
        open ? "scale-100 shadow-lg " : "scale-97 shadow-md",
        "group z-10 flex flex-row rounded-lg bg-white text-slate-900 transition-transform duration-300 ease-in-out"
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
            {!isMultiLanguageAllowed && !isFormbricksCloud && !isMultiLanguageActivated ? (
              <UpgradePlanNotice
                message="To enable multi-language surveys, you need an active"
                url={`/environments/${environmentId}/settings/enterprise`}
                textForUrl="enterprise license."
              />
            ) : !isMultiLanguageAllowed && isFormbricksCloud && !isMultiLanguageActivated ? (
              <UpgradePlanNotice
                message="To enable multi-language surveys,"
                url={`/environments/${environmentId}/settings/billing`}
                textForUrl="please add your credit card."
              />
            ) : (
              <>
                {product.languages.length <= 1 && (
                  <div className="mb-4 text-sm italic text-slate-500">
                    {product.languages.length === 0
                      ? "No languages found. Add the first one to get started:"
                      : "You need to have two or more languages set up in your product to work with translations."}
                  </div>
                )}
                {product.languages.length > 1 && (
                  <div className="my-4 space-y-4">
                    <div>
                      {isMultiLanguageAllowed && !isMultiLanguageActivated && (
                        <div className="text-sm italic text-slate-500">
                          Switch multi-lanugage on to get started 👉
                        </div>
                      )}
                    </div>

                    {isMultiLanguageActivated && (
                      <div className="space-y-4">
                        <DefaultLanguageSelect
                          defaultLanguage={defaultLanguage}
                          handleDefaultLanguageChange={handleDefaultLanguageChange}
                          product={product}
                          setConfirmationModalInfo={setConfirmationModalInfo}
                        />
                        {defaultLanguage && (
                          <SecondaryLanguageSelect
                            product={product}
                            defaultLanguage={defaultLanguage}
                            localSurvey={localSurvey}
                            updateSurveyLanguages={updateSurveyLanguages}
                            setActiveQuestionId={setActiveQuestionId}
                            setSelectedLanguageCode={setSelectedLanguageCode}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                <Link href={`/environments/${environmentId}/settings/language`} target="_blank">
                  <Button className="mt-2" variant="secondary" size="sm">
                    Manage Languages <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}

            <ConfirmationModal
              title={confirmationModalInfo.title}
              open={confirmationModalInfo.open}
              setOpen={() => setConfirmationModalInfo((prev) => ({ ...prev, open: !prev.open }))}
              text={confirmationModalInfo.text}
              onConfirm={confirmationModalInfo.onConfirm}
              buttonText={confirmationModalInfo.buttonText}
              buttonVariant={confirmationModalInfo.buttonVariant}
            />
          </div>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </div>
  );
};
