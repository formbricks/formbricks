"use client";

import { CopyIcon, LinkIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { PublishedLinkSurvey } from "@/modules/ee/contacts/lib/surveys";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { generatePersonalSurveyLinkAction } from "../actions";

interface GeneratePersonalLinkModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  contactId: string;
  publishedLinkSurveys: PublishedLinkSurvey[];
}

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.warn("Failed to copy to clipboard:", error);
    return false;
  }
};

export const GeneratePersonalLinkModal = ({
  open,
  setOpen,
  contactId,
  publishedLinkSurveys,
}: GeneratePersonalLinkModalProps) => {
  const { t } = useTranslation();
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) {
    } else {
      setSelectedSurveyId(undefined);
      setGeneratedUrl("");
    }
  }, [open]);

  const handleCopyUrl = useCallback(
    async (url: string) => {
      const success = await copyToClipboard(url);
      if (success) {
        toast.success(t("common.copied_to_clipboard"));
      } else {
        toast.error(t("common.failed_to_copy_to_clipboard"));
      }
    },
    [t]
  );

  const handleGenerate = async () => {
    if (!selectedSurveyId) {
      toast.error(t("environments.contacts.please_select_a_survey"));
      return;
    }
    setIsLoading(true);
    const response = await generatePersonalSurveyLinkAction({
      contactId,
      surveyId: selectedSurveyId,
    });

    if (response?.data) {
      const surveyUrl = response?.data?.surveyUrl;
      if (!surveyUrl) {
        toast.error(t("common.something_went_wrong_please_try_again"));
        return;
      }

      setGeneratedUrl(surveyUrl);
      const success = await copyToClipboard(surveyUrl);

      if (success) {
        toast.success(t("common.copied_to_clipboard"));
      } else {
        toast.error(
          t("environments.contacts.personal_link_generated_but_clipboard_failed", {
            url: surveyUrl,
          }) || `${t("environments.contacts.personal_link_generated")}: ${surveyUrl}`,
          { duration: 6000 }
        );
      }
    } else {
      const errorMessage = getFormattedErrorMessage(response);
      toast.error(errorMessage || t("common.something_went_wrong_please_try_again"));
      return;
    }
    setIsLoading(false);
  };

  const getSelectPlaceholder = () => {
    if (publishedLinkSurveys.length === 0) return t("environments.contacts.no_published_surveys");
    return t("environments.contacts.select_a_survey");
  };

  const isDisabled = isLoading || publishedLinkSurveys.length === 0;
  const canGenerate = selectedSurveyId && !isDisabled;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <LinkIcon className="h-4 w-4" />
          <DialogTitle>{t("environments.contacts.generate_personal_link")}</DialogTitle>
          <DialogDescription>
            {t("environments.contacts.generate_personal_link_description")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="m-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="survey-select">{t("common.select_survey")}</Label>
              <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId} disabled={isDisabled}>
                <SelectTrigger id="survey-select">
                  <SelectValue placeholder={getSelectPlaceholder()} />
                </SelectTrigger>
                <SelectContent>
                  {publishedLinkSurveys.map((survey) => (
                    <SelectItem key={survey.id} value={survey.id}>
                      {survey.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {publishedLinkSurveys.length === 0 && (
                <p className="text-sm text-slate-500">
                  {t("environments.contacts.no_published_link_surveys_available")}
                </p>
              )}
            </div>

            {generatedUrl && (
              <div className="space-y-2">
                <Label htmlFor="generated-url">{t("environments.contacts.personal_survey_link")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="generated-url"
                    value={generatedUrl}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button variant="secondary" onClick={() => handleCopyUrl(generatedUrl)} className="gap-1">
                    <CopyIcon className="h-4 w-4" />
                    {t("common.copy")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={isLoading}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleGenerate} disabled={!canGenerate}>
            {isLoading ? t("common.saving") : t("common.generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
