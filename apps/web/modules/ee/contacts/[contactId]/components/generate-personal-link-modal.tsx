"use client";

import { LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
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
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { generatePersonalSurveyLinkAction, getPublishedLinkSurveysAction } from "../actions";

interface GeneratePersonalLinkModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  contactId: string;
  environmentId: string;
}

export const GeneratePersonalLinkModal = ({
  open,
  setOpen,
  contactId,
  environmentId,
}: GeneratePersonalLinkModalProps) => {
  const { t } = useTranslation();
  const [surveys, setSurveys] = useState<TSurvey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSurveys, setIsFetchingSurveys] = useState(false);

  const fetchSurveys = async () => {
    setIsFetchingSurveys(true);
    try {
      const response = await getPublishedLinkSurveysAction({ environmentId });

      if (response?.data) {
        setSurveys(response.data);
      } else {
        const errorMessage = getFormattedErrorMessage(response);
        toast.error(errorMessage || t("common.something_went_wrong_please_try_again"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsFetchingSurveys(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSurveys();
    } else {
      // Reset state when modal closes
      setSelectedSurveyId("");
      setSurveys([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, environmentId]);

  const handleGenerate = async () => {
    if (!selectedSurveyId) {
      toast.error(t("environments.contacts.please_select_a_survey"));
      return;
    }

    setIsLoading(true);
    try {
      const response = await generatePersonalSurveyLinkAction({
        contactId,
        surveyId: selectedSurveyId,
      });

      if (response?.serverError) {
        toast.error(response.serverError);
        return;
      }

      if (response?.validationErrors) {
        const errorMessage = getFormattedErrorMessage(response);
        toast.error(errorMessage || t("common.something_went_wrong_please_try_again"));
        return;
      }

      if (response?.data?.surveyUrl) {
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(response.data.surveyUrl);
          toast.success(t("common.copied_to_clipboard"));
          setOpen(false);
        } catch (_clipboardError) {
          // If clipboard fails, still show success but with the URL
          toast.success(t("environments.contacts.personal_link_generated"));
        }
      } else {
        toast.error(t("common.something_went_wrong_please_try_again"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsLoading(false);
    }
  };

  const selectPlaceholder = isFetchingSurveys
    ? t("common.loading")
    : surveys.length === 0
      ? t("environments.contacts.no_published_surveys")
      : t("environments.contacts.select_a_survey");

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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="survey-select">{t("common.select_survey")}</Label>
              <Select
                value={selectedSurveyId}
                onValueChange={setSelectedSurveyId}
                disabled={isFetchingSurveys || isLoading || surveys.length === 0}>
                <SelectTrigger id="survey-select">
                  <SelectValue placeholder={selectPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {surveys.map((survey) => (
                    <SelectItem key={survey.id} value={survey.id}>
                      {survey.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {surveys.length === 0 && !isFetchingSurveys && (
                <p className="text-sm text-slate-500">
                  {t("environments.contacts.no_published_link_surveys_available")}
                </p>
              )}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={isLoading}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!selectedSurveyId || isLoading || isFetchingSurveys || surveys.length === 0}>
            {isLoading ? t("common.saving") : t("common.generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
