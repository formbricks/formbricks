"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { DatePicker } from "@/modules/ui/components/date-picker";
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
import Link from "next/link";
import { useState } from "react";
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
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
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
    toast.loading(t("environments.surveys.summary.generating_links_toast"), {
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
      toast.success(t("environments.surveys.summary.links_generated_success_toast"), {
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
    ? t("environments.surveys.summary.generating_links")
    : t("environments.surveys.summary.generate_and_download_links");

  if (!isContactsEnabled) {
    return (
      <UpgradePrompt
        title={t("environments.surveys.summary.personal_links_upgrade_prompt_title")}
        description={t("environments.surveys.summary.personal_links_upgrade_prompt_description")}
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
    <div className="flex h-full grow flex-col gap-6">
      <div>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">
          {t("environments.surveys.summary.generate_personal_links_title")}
        </h2>
        <p className="text-sm text-slate-600">
          {t("environments.surveys.summary.generate_personal_links_description")}
        </p>
      </div>

      <div className="space-y-6">
        {/* Recipients Section */}
        <div>
          <label htmlFor="segment-select" className="mb-2 block text-sm font-medium text-slate-700">
            {t("common.recipients")}
          </label>
          <Select
            value={selectedSegment}
            onValueChange={setSelectedSegment}
            disabled={publicSegments.length === 0}>
            <SelectTrigger id="segment-select" className="w-full bg-white">
              <SelectValue
                placeholder={
                  publicSegments.length === 0
                    ? t("environments.surveys.summary.no_segments_available")
                    : t("environments.surveys.summary.select_segment")
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
          <p className="mt-1 text-xs text-slate-500">
            {t("environments.surveys.summary.create_and_manage_segments")}
          </p>
        </div>

        {/* Expiry Date Section */}
        <div>
          <label htmlFor="expiry-date-picker" className="mb-2 block text-sm font-medium text-slate-700">
            {t("environments.surveys.summary.expiry_date_optional")}
          </label>
          <div id="expiry-date-picker">
            <RestrictedDatePicker
              date={expiryDate}
              updateSurveyDate={(date: Date | null) => setExpiryDate(date)}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t("environments.surveys.summary.expiry_date_description")}
          </p>
        </div>

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
      <hr />

      {/* Info Box */}
      <Alert variant="info" size="small">
        <AlertTitle>{t("environments.surveys.summary.personal_links_work_with_segments")}</AlertTitle>
        <AlertButton>
          <Link
            href="https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/advanced-targeting#segment-configuration"
            target="_blank"
            rel="noopener noreferrer">
            {t("common.learn_more")}
          </Link>
        </AlertButton>
      </Alert>
    </div>
  );
};
