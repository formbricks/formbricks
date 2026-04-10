"use client";

import { Download, FileImage, FileText, Globe, Loader2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { TSurvey } from "@formbricks/types/surveys/types";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface SurveyExportDropdownProps {
  survey: TSurvey;
}

export const SurveyExportDropdown = ({ survey }: SurveyExportDropdownProps) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExportHtml = async () => {
    setIsExporting("html");
    try {
      const { surveyToExportable } = await import("../lib/survey-export/transform");
      const { generateSurveyHtml } = await import("../lib/survey-export/generate-html");
      const { openHtmlInNewTab } = await import("../lib/survey-export/download");

      const data = surveyToExportable(survey);
      const html = generateSurveyHtml(data);
      openHtmlInNewTab(html);
      toast.success("Survey exported as HTML");
    } catch (err) {
      console.error("HTML export failed:", err);
      toast.error("Failed to export as HTML");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting("pdf");
    try {
      const { surveyToExportable } = await import("../lib/survey-export/transform");
      const { generateSurveyPdf } = await import("../lib/survey-export/generate-pdf");
      const { downloadBlob } = await import("../lib/survey-export/download");

      const data = surveyToExportable(survey);
      const blob = await generateSurveyPdf(data);
      downloadBlob(blob, `${survey.name.replace(/[^a-zA-Z0-9]/g, "_")}_survey.pdf`);
      toast.success("Survey exported as PDF");
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("Failed to export as PDF");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportDocx = async () => {
    setIsExporting("docx");
    try {
      const { surveyToExportable } = await import("../lib/survey-export/transform");
      const { generateSurveyDocx } = await import("../lib/survey-export/generate-docx");
      const { downloadBlob } = await import("../lib/survey-export/download");

      const data = surveyToExportable(survey);
      const blob = await generateSurveyDocx(data);
      downloadBlob(blob, `${survey.name.replace(/[^a-zA-Z0-9]/g, "_")}_survey.docx`);
      toast.success("Survey exported as DOCX");
    } catch (err) {
      console.error("DOCX export failed:", err);
      toast.error("Failed to export as DOCX");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <TooltipRenderer tooltipContent="Export survey">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="border border-slate-300 bg-white hover:bg-slate-50">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
      </TooltipRenderer>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleExportPdf} disabled={isExporting !== null}>
          <FileImage className="mr-2 h-4 w-4 text-red-500" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportDocx} disabled={isExporting !== null}>
          <FileText className="mr-2 h-4 w-4 text-blue-500" />
          Export as DOCX
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportHtml} disabled={isExporting !== null}>
          <Globe className="mr-2 h-4 w-4 text-green-500" />
          Export as HTML
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
