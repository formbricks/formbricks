"use client";

import { DocumentationLinks } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/documentation-links";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { DatePicker } from "@/modules/ui/components/date-picker";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";
import { useTranslate } from "@tolgee/react";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TSegment } from "@formbricks/types/segment";
import { generatePersonalLinksAction } from "../../actions";

interface PersonalLinksTabProps {
  environmentId: string;
  surveyId: string;
  segments: TSegment[];
  isContactsEnabled: boolean;
  isFormbricksCloud: boolean;
}

interface PersonalLinksFormData {
  selectedSegment: string;
  expiryDate: Date | null;
}

// Custom DatePicker component with date restrictions
const RestrictedDatePicker = ({
  date,
  updateSurveyDate,
}: {
  date: Date | null;
  updateSurveyDate: (date: Date | null) => void;
}) => {
  // Get tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const handleDateUpdate = (date: Date) => {
    updateSurveyDate(date);
  };

  return (
    <DatePicker
      date={date}
      updateSurveyDate={handleDateUpdate}
      minDate={tomorrow}
      onClearDate={() => updateSurveyDate(null)}
    />
  );
};

export const PersonalLinksTab = ({
  environmentId,
  segments,
  surveyId,
  isContactsEnabled,
  isFormbricksCloud,
}: PersonalLinksTabProps) => {
  const { t } = useTranslate();

  const form = useForm<PersonalLinksFormData>({
    defaultValues: {
      selectedSegment: "",
      expiryDate: null,
    },
  });

  const { watch } = form;
  const selectedSegment = watch("selectedSegment");
  const expiryDate = watch("expiryDate");

  const [isGenerating, setIsGenerating] = useState(false);
  const publicSegments = segments.filter((segment) => !segment.isPrivate);

  // Utility function for file downloads
  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateLinks = async () => {
    if (!selectedSegment || isGenerating) return;

    setIsGenerating(true);

    // Show initial toast
    toast.loading(t("environments.surveys.share.personal_links.generating_links_toast"), {
      duration: 5000,
      id: "generating-links",
    });

    const result = await generatePersonalLinksAction({
      surveyId: surveyId,
      segmentId: selectedSegment,
      environmentId: environmentId,
      expirationDays: expiryDate
        ? Math.max(1, Math.floor((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        : undefined,
    });

    if (result?.data) {
      downloadFile(result.data.downloadUrl, result.data.fileName || "personal-links.csv");
      toast.success(t("environments.surveys.share.personal_links.links_generated_success_toast"), {
        duration: 5000,
        id: "generating-links",
      });
    } else {
      const errorMessage = getFormattedErrorMessage(result);
      toast.error(errorMessage, {
        duration: 5000,
        id: "generating-links",
      });
    }
    setIsGenerating(false);
  };

  // Button state logic
  const isButtonDisabled = !selectedSegment || isGenerating || publicSegments.length === 0;
  const buttonText = isGenerating
    ? t("environments.surveys.share.personal_links.generating_links")
    : t("environments.surveys.share.personal_links.generate_and_download_links");

  if (!isContactsEnabled) {
    return (
      <UpgradePrompt
        title={t("environments.surveys.share.personal_links.upgrade_prompt_title")}
        description={t("environments.surveys.share.personal_links.upgrade_prompt_description")}
        buttons={[
          {
            text: isFormbricksCloud ? t("common.start_free_trial") : t("common.request_trial_license"),
            href: isFormbricksCloud
              ? `/environments/${environmentId}/settings/billing`
              : "https://formbricks.com/upgrade-self-hosting-license",
          },
          {
            text: t("common.learn_more"),
            href: isFormbricksCloud
              ? `/environments/${environmentId}/settings/billing`
              : "https://formbricks.com/learn-more-self-hosting-license",
          },
        ]}
      />
    );
  }

  return (
    <div className="flex h-full flex-col justify-between space-y-4">
      <FormProvider {...form}>
        <div className="flex grow flex-col gap-6">
          {/* Recipients Section */}
          <FormField
            control={form.control}
            name="selectedSegment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("common.recipients")}</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={publicSegments.length === 0}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue
                        placeholder={
                          publicSegments.length === 0
                            ? t("environments.surveys.share.personal_links.no_segments_available")
                            : t("environments.surveys.share.personal_links.select_segment")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {publicSegments.map((segment) => (
                        <SelectItem key={segment.id} value={segment.id}>
                          {segment.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  {t("environments.surveys.share.personal_links.create_and_manage_segments")}
                </FormDescription>
              </FormItem>
            )}
          />

          {/* Expiry Date Section */}
          <FormField
            control={form.control}
            name="expiryDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("environments.surveys.share.personal_links.expiry_date_optional")}</FormLabel>
                <FormControl>
                  <RestrictedDatePicker date={field.value} updateSurveyDate={field.onChange} />
                </FormControl>
                <FormDescription>
                  {t("environments.surveys.share.personal_links.expiry_date_description")}
                </FormDescription>
              </FormItem>
            )}
          />

          {/* Generate Button */}
          <Button
            onClick={handleGenerateLinks}
            disabled={isButtonDisabled}
            loading={isGenerating}
            className="w-fit">
            <DownloadIcon className="mr-2 h-4 w-4" />
            {buttonText}
          </Button>
        </div>
      </FormProvider>
      <DocumentationLinks
        links={[
          {
            title: t("environments.surveys.share.personal_links.work_with_segments"),
            href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/advanced-targeting#segment-configuration",
          },
        ]}
      />
    </div>
  );
};
