"use client";

import { parse } from "csv-parse/sync";
import { ArrowUpFromLineIcon, FileUpIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/cn";
import { importContactsAction } from "@/modules/contacts/actions";
import { CsvTable } from "@/modules/contacts/components/csv-table";
import { EnrichmentConfigForm } from "@/modules/contacts/components/enrichment-config-form";
import { enrichContactsBatch } from "@/modules/contacts/lib/contact-enrichment";
import { TEnrichmentConfig } from "@/modules/contacts/types/enrichment";
import { Alert } from "@/modules/ui/components/alert";
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
import { ProgressBar } from "@/modules/ui/components/progress-bar";

interface UploadContactsCSVButtonProps {
  environmentId: string;
  onUploadComplete?: (data: Record<string, string>[]) => void;
}

export const UploadContactsCSVButton = ({
  environmentId,
  onUploadComplete,
}: UploadContactsCSVButtonProps) => {
  const [open, setOpen] = useState(false);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [enrichedData, setEnrichedData] = useState<Record<string, string>[]>([]);
  const [enrichmentConfig, setEnrichmentConfig] = useState<TEnrichmentConfig | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);
  const [showPreview, setShowPreview] = useState<"original" | "enriched">("original");

  const processCSVFile = async (file: File) => {
    if (!file) return;

    // Check file type
    if (!file.type && !file.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }

    if (file.type && file.type !== "text/csv" && !file.type.includes("csv")) {
      setError("Please upload a CSV file");
      return;
    }

    // Max file size check (800KB)
    const maxSizeInBytes = 800 * 1024;
    if (file.size > maxSizeInBytes) {
      setError("File size exceeds the maximum limit of 800KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      setError("");
      const csv = e.target?.result as string;

      try {
        const records = parse(csv, {
          columns: true,
          skip_empty_lines: true,
        });

        if (!records || !Array.isArray(records) || records.length === 0) {
          setError("The uploaded CSV file does not contain any valid data");
          return;
        }

        setCsvData(records);
        setEnrichedData([]);
        setShowPreview("original");
      } catch (error) {
        console.error("Error parsing CSV:", error);
        setError("Failed to parse CSV file. Please check the format.");
      }
    };

    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (file) {
      processCSVFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const items = Array.from(e.dataTransfer.items);
    const isCSV = items.some(
      (item) => item.type === "text/csv" || (item.type === "" && item.kind === "file")
    );
    e.dataTransfer.dropEffect = isCSV ? "copy" : "none";
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      processCSVFile(file);
    }
  };

  const handleEnrichData = async () => {
    if (!enrichmentConfig || csvData.length === 0) {
      return;
    }

    setEnriching(true);
    setError("");
    setEnrichmentProgress(0);

    try {
      const result = await enrichContactsBatch(csvData, enrichmentConfig, {
        maxConcurrent: 3,
        onProgress: (processed, total) => {
          setEnrichmentProgress(Math.round((processed / total) * 100));
        },
      });

      const enrichedRecords = result.results
        .filter((r) => r.success && r.enrichedData)
        .map((r) => r.enrichedData!);

      if (enrichedRecords.length === 0) {
        setError("Failed to enrich any contacts. Please check your API configuration.");
        setEnriching(false);
        return;
      }

      setEnrichedData(enrichedRecords);
      setShowPreview("enriched");

      if (result.errorCount > 0) {
        toast.success(`Enriched ${result.successCount} contacts. ${result.errorCount} failed.`, {
          duration: 5000,
        });
      } else {
        toast.success(`Successfully enriched all ${result.successCount} contacts`);
      }
    } catch (error) {
      console.error("Enrichment error:", error);
      setError("An error occurred during enrichment. Please try again.");
    } finally {
      setEnriching(false);
      setEnrichmentProgress(0);
    }
  };

  const handleUpload = async () => {
    const dataToUpload = enrichedData.length > 0 ? enrichedData : csvData;

    if (dataToUpload.length === 0) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Import contacts via server action
      const result = await importContactsAction({
        environmentId,
        contacts: dataToUpload,
      });

      if (result?.data) {
        toast.success(`Successfully processed ${result.data.contactsProcessed} contacts`);

        // Call the optional callback
        if (onUploadComplete) {
          onUploadComplete(dataToUpload);
        }

        resetState(true);
      } else if (result?.serverError) {
        setError(result.serverError);
      } else {
        setError("An error occurred while uploading contacts. Please try again.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      setError("An error occurred while uploading contacts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetState = (closeModal?: boolean) => {
    setCsvData([]);
    setEnrichedData([]);
    setEnrichmentConfig(null);
    setError("");
    setLoading(false);
    setEnriching(false);
    setEnrichmentProgress(0);
    setShowPreview("original");

    if (closeModal) {
      setOpen(false);
    }
  };

  const handleDownloadExampleCSV = () => {
    const exampleData = [
      { email: "user1@example.com", userId: "1001", firstName: "John", lastName: "Doe" },
      { email: "user2@example.com", userId: "1002", firstName: "Jane", lastName: "Smith" },
      { email: "user3@example.com", userId: "1003", firstName: "Mark", lastName: "Jones" },
    ];

    const headers = Object.keys(exampleData[0]);
    const csvRows = [headers.join(","), ...exampleData.map((row) => headers.map((h) => row[h]).join(","))];
    const csvString = csvRows.join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvString);

    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "example.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const csvColumns = csvData.length > 0 ? Object.keys(csvData[0]) : [];
  const previewData = showPreview === "enriched" && enrichedData.length > 0 ? enrichedData : csvData;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Upload CSV
        <PlusIcon />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          setOpen(newOpen);
          if (!newOpen) {
            resetState();
          }
        }}>
        <DialogContent disableCloseOnOutsideClick={true} unconstrained={true}>
          <DialogHeader>
            <FileUpIcon />
            <DialogTitle>Upload Contacts CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with contact data. Optionally enrich contacts from an external API before
              importing.
            </DialogDescription>
          </DialogHeader>

          <DialogBody unconstrained={false}>
            <div className="flex flex-col gap-4">
              {error && (
                <Alert variant="error" size="small">
                  {error}
                </Alert>
              )}

              {/* CSV Upload Section */}
              <div className="flex flex-col gap-2">
                <div className="no-scrollbar rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4">
                  {csvData.length === 0 ? (
                    <div>
                      <label
                        htmlFor="file"
                        className={cn(
                          "relative flex cursor-pointer flex-col items-center justify-center rounded-lg hover:bg-slate-100"
                        )}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}>
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <ArrowUpFromLineIcon className="h-6 text-slate-500" />
                          <p className={cn("mt-2 text-center text-sm text-slate-500")}>
                            <span className="font-semibold">Click to upload or drag and drop</span>
                          </p>
                          <input
                            type="file"
                            id="file"
                            name="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex w-full items-center justify-between">
                        <h3 className="font-medium text-slate-700">Preview ({csvData.length} contacts)</h3>
                        {enrichedData.length > 0 && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={showPreview === "original" ? "default" : "secondary"}
                              onClick={() => setShowPreview("original")}>
                              Original
                            </Button>
                            <Button
                              size="sm"
                              variant={showPreview === "enriched" ? "default" : "secondary"}
                              onClick={() => setShowPreview("enriched")}>
                              Enriched
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="max-h-[300px] w-full overflow-auto rounded-md border border-slate-300">
                        <CsvTable data={previewData.slice(0, 11)} />
                      </div>
                    </div>
                  )}
                </div>
                {csvData.length === 0 && (
                  <div className="flex justify-start">
                    <Button onClick={handleDownloadExampleCSV} variant="secondary">
                      Download Example CSV
                    </Button>
                  </div>
                )}
              </div>

              {/* Enrichment Configuration */}
              {csvData.length > 0 && (
                <>
                  <EnrichmentConfigForm
                    csvColumns={csvColumns}
                    onConfigChange={setEnrichmentConfig}
                    initialConfig={enrichmentConfig ?? undefined}
                  />

                  {enrichmentConfig && enrichedData.length === 0 && (
                    <div className="flex flex-col gap-2">
                      <Button onClick={handleEnrichData} loading={enriching} disabled={enriching}>
                        {enriching ? "Enriching Contacts..." : "Enrich Contacts"}
                      </Button>
                      {enriching && (
                        <div className="flex flex-col gap-1">
                          <ProgressBar progress={enrichmentProgress} height={5} barColor="bg-brand-dark" />
                          <p className="text-center text-xs text-slate-500">{enrichmentProgress}% complete</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            {csvData.length > 0 && (
              <Button variant="secondary" onClick={() => resetState()}>
                Pick Different File
              </Button>
            )}

            <Button onClick={handleUpload} loading={loading} disabled={loading || csvData.length === 0}>
              Upload {enrichedData.length > 0 ? "Enriched " : ""}Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
