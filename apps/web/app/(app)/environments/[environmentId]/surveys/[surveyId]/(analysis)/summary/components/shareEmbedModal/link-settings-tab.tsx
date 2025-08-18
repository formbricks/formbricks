"use client";

import { useSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/context/survey-context";
import { createI18nString, extractLanguageCodes, getEnabledLanguages } from "@/lib/i18n/utils";
import { updateSurveyAction } from "@/modules/survey/editor/actions";
import { Button } from "@/modules/ui/components/button";
import { FileInput } from "@/modules/ui/components/file-input";
import {
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { useTranslate } from "@tolgee/react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { getLanguageLabel } from "@formbricks/i18n-utils/src/utils";
import { TI18nString, TSurvey, TSurveyMetadata } from "@formbricks/types/surveys/types";

interface LinkSettingsTabProps {
  isReadOnly: boolean;
  locale: string;
}

interface LinkSettingsFormData {
  title: TI18nString;
  description: TI18nString;
  ogImage?: string;
}

export const LinkSettingsTab = ({ isReadOnly, locale }: LinkSettingsTabProps) => {
  const { t } = useTranslate();
  const { survey } = useSurvey();
  const enabledLanguages = getEnabledLanguages(survey.languages);
  const hasMultipleLanguages = enabledLanguages.length > 1;

  // Set default language - use 'default' if no multi-language is set up
  const defaultLanguageCode = hasMultipleLanguages
    ? survey.languages.find((lang) => lang.default)?.language.code || "default"
    : "default";

  const languageCodes = useMemo(() => extractLanguageCodes(survey.languages), [survey.languages]);

  const [selectedLanguageCode, setSelectedLanguageCode] = useState(defaultLanguageCode);
  const [isSaving, setIsSaving] = useState(false);

  // Current language code for metadata storage
  const currentLangCode = selectedLanguageCode === defaultLanguageCode ? "default" : selectedLanguageCode;

  // Initialize form with current values - memoize to prevent re-initialization
  const initialFormData = useMemo(() => {
    const metadata = survey.metadata || {
      title: createI18nString("", languageCodes),
      description: createI18nString("", languageCodes),
      ogImage: undefined,
    };

    return {
      title: metadata.title || createI18nString("", languageCodes),
      description: metadata.description || createI18nString("", languageCodes),
      ogImage: metadata.ogImage || "",
    };
  }, [survey.metadata, languageCodes]);

  const form = useForm<LinkSettingsFormData>({
    defaultValues: initialFormData,
  });

  const {
    handleSubmit,
    setValue,
    reset,
    formState: { isDirty },
  } = form;

  const handleFileUpload = (urls: string[] | undefined) => {
    if (urls && urls.length > 0) {
      setValue("ogImage", urls[0], { shouldDirty: true });
    } else {
      // Handle removal of the image
      setValue("ogImage", "", { shouldDirty: true });
    }
  };

  const onSubmit = async (data: LinkSettingsFormData) => {
    if (isSaving || isReadOnly) return;

    setIsSaving(true);

    // Get current linkMetadata
    const currentSurveyMetadata = survey.metadata || {
      title: createI18nString("", languageCodes),
      description: createI18nString("", languageCodes),
      ogImage: undefined,
    };

    // Merge form data with existing linkMetadata
    const updatedTitle: TI18nString = {
      ...currentSurveyMetadata.title,
      ...data.title,
    };

    const updatedDescription: TI18nString = {
      ...currentSurveyMetadata.description,
      ...data.description,
    };

    const updatedSurveyMetadata: TSurveyMetadata = {
      title: updatedTitle,
      description: updatedDescription,
      ogImage: data.ogImage || undefined,
    };

    const updatedSurvey: TSurvey = {
      ...survey,
      metadata: updatedSurveyMetadata,
    };

    const result = await updateSurveyAction(updatedSurvey);

    if (result?.data) {
      toast.success(t("environments.surveys.edit.settings_saved_successfully"));
      reset(data);
    } else {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }

    setIsSaving(false);
  };

  const inputFields: {
    name: "title" | "description";
    label: string;
    description: string;
    placeholder: string;
  }[] = [
    {
      name: "title",
      label: t("environments.surveys.share.link_settings.link_title"),
      description: t("environments.surveys.share.link_settings.link_title_description"),
      placeholder: survey.name,
    },
    {
      name: "description",
      label: t("environments.surveys.share.link_settings.link_description"),
      description: t("environments.surveys.share.link_settings.link_description_description"),
      placeholder: "Please complete this survey.",
    },
  ];

  return (
    <div className="px-1">
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Language Selection - only show if survey has multiple languages */}
          {hasMultipleLanguages && (
            <FormItem>
              <FormLabel>{t("common.language")}</FormLabel>
              <FormControl>
                <Select value={selectedLanguageCode} onValueChange={setSelectedLanguageCode}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledLanguages.map((lang) => (
                      <SelectItem key={lang.language.code} value={lang.language.code} className="bg-white">
                        {getLanguageLabel(lang.language.code, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>
                {t("environments.surveys.share.link_settings.language_help_text")}
              </FormDescription>
            </FormItem>
          )}

          {inputFields.map((inputField) => {
            return (
              <FormField
                key={inputField.name}
                control={form.control}
                name={inputField.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{inputField.label}</FormLabel>
                    <FormControl>
                      <Input
                        value={field.value[currentLangCode] || ""}
                        className="bg-white"
                        onChange={(e) => {
                          const updatedValue = {
                            ...field.value,
                            [currentLangCode]: e.target.value,
                          };
                          field.onChange(updatedValue);
                        }}
                        placeholder={inputField.placeholder}
                        disabled={isReadOnly}
                      />
                    </FormControl>
                    <FormDescription>{inputField.description}</FormDescription>
                    <FormError />
                  </FormItem>
                )}
              />
            );
          })}

          {/* Preview Image */}
          <FormField
            control={form.control}
            name="ogImage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("environments.surveys.share.link_settings.preview_image")}</FormLabel>
                <FormControl>
                  <FileInput
                    id={`og-image-upload-${survey.id}`}
                    allowedFileExtensions={["png", "jpeg", "jpg", "webp"]}
                    environmentId={survey.environmentId}
                    onFileUpload={handleFileUpload}
                    fileUrl={field.value}
                    maxSizeInMB={5}
                    disabled={isReadOnly}
                  />
                </FormControl>
                <FormDescription>
                  {t("environments.surveys.share.link_settings.preview_image_description")}
                </FormDescription>
                <FormError />
              </FormItem>
            )}
          />

          {/* Save Button */}
          <Button type="submit" disabled={isSaving || isReadOnly || !isDirty}>
            {isSaving ? t("common.saving") : t("common.save")}
          </Button>
        </form>
      </FormProvider>
    </div>
  );
};
