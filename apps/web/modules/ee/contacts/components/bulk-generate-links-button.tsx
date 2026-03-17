"use client";

import { DownloadIcon, LinkIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { generateBulkPersonalLinksAction } from "@/modules/ee/contacts/actions";
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

interface BulkGenerateLinksButtonProps {
  environmentId: string;
  publishedLinkSurveys: PublishedLinkSurvey[];
}

export const BulkGenerateLinksButton = ({
  environmentId,
  publishedLinkSurveys,
}: BulkGenerateLinksButtonProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | undefined>(undefined);
  const [expirationDays, setExpirationDays] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!selectedSurveyId) {
      toast.error("Please select a survey");
      return;
    }

    setIsLoading(true);
    try {
      const response = await generateBulkPersonalLinksAction({
        environmentId,
        surveyId: selectedSurveyId,
        expirationDays: expirationDays ? parseInt(expirationDays, 10) : undefined,
      });

      if (response?.data) {
        const links = response.data;
        if (links.length === 0) {
          toast.error("No contacts found to generate links for");
          setIsLoading(false);
          return;
        }

        // Build CSV content with proper escaping
        const escapeCsv = (v: string): string => {
          // Escape double quotes by doubling them
          let escaped = v.replace(/"/g, '""');
          // Mitigate formula injection: prefix cells starting with =, +, -, @ with a single quote
          if (/^[=+\-@]/.test(escaped)) {
            escaped = "'" + escaped;
          }
          return `"${escaped}"`;
        };

        const headers = ["email", "firstName", "lastName", "userId", "personalLink"];
        const rows = links.map((link) => [
          link.attributes.email || "",
          link.attributes.firstName || "",
          link.attributes.lastName || "",
          link.attributes.userId || "",
          link.surveyUrl,
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map((row) => row.map(escapeCsv).join(",")),
        ].join("\n");

        // Download the CSV
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `personal-links-${selectedSurveyId.slice(0, 8)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`Generated ${links.length} personal links`);
        setOpen(false);
        setSelectedSurveyId(undefined);
        setExpirationDays("");
      } else {
        const errorMessage = getFormattedErrorMessage(response);
        toast.error(errorMessage || "Failed to generate links");
      }
    } catch {
      toast.error("Failed to generate links");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <LinkIcon className="h-4 w-4" />
        Bulk Links
      </Button>
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          if (!isLoading) {
            setOpen(newOpen);
            if (!newOpen) {
              setSelectedSurveyId(undefined);
              setExpirationDays("");
            }
          }
        }}>
        <DialogContent>
          <DialogHeader>
            <LinkIcon className="h-4 w-4" />
            <DialogTitle>Generate Personal Links for All Contacts</DialogTitle>
            <DialogDescription>
              Generate a unique survey link for every contact and download as a CSV file for mail merge.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="m-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-survey-select">{t("common.select_survey")}</Label>
                <Select
                  value={selectedSurveyId}
                  onValueChange={setSelectedSurveyId}
                  disabled={isLoading || publishedLinkSurveys.length === 0}>
                  <SelectTrigger id="bulk-survey-select">
                    <SelectValue
                      placeholder={
                        publishedLinkSurveys.length === 0 ? "No published link surveys" : "Select a survey..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {publishedLinkSurveys.map((survey) => (
                      <SelectItem key={survey.id} value={survey.id}>
                        {survey.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration-days">Link Expiration (days, optional)</Label>
                <Input
                  id="expiration-days"
                  type="number"
                  min="1"
                  placeholder="No expiration"
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-slate-500">
                  Leave empty for links that never expire.
                </p>
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isLoading}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleGenerate} disabled={!selectedSurveyId || isLoading}>
              {isLoading ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <DownloadIcon className="h-4 w-4" />
                  Generate & Download CSV
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
