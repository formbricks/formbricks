"use client";

import {
  ArrowUpFromLineIcon,
  CloudIcon,
  CopyIcon,
  FolderIcon,
  RefreshCwIcon,
  SettingsIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import { MappingUI } from "./mapping-ui";
import { TFieldMapping, TSourceField } from "./types";

interface CsvSourceUIProps {
  sourceFields: TSourceField[];
  mappings: TFieldMapping[];
  onMappingsChange: (mappings: TFieldMapping[]) => void;
  onSourceFieldsChange: (fields: TSourceField[]) => void;
  onLoadSampleCSV: () => void;
}

export function CsvSourceUI({
  sourceFields,
  mappings,
  onMappingsChange,
  onSourceFieldsChange,
  onLoadSampleCSV,
}: CsvSourceUIProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [showMapping, setShowMapping] = useState(false);
  const [s3AutoSync, setS3AutoSync] = useState(false);
  const [s3Copied, setS3Copied] = useState(false);

  // Mock S3 bucket details
  const s3BucketName = "formbricks-feedback-imports";
  const s3Path = `s3://${s3BucketName}/feedback/incoming/`;

  const handleCopyS3Path = () => {
    navigator.clipboard.writeText(s3Path);
    setS3Copied(true);
    setTimeout(() => setS3Copied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (file) {
      processCSVFile(file);
    }
  };

  const processCSVFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      return;
    }

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      const lines = csv.split("\n").slice(0, 6); // Preview first 5 rows + header
      const preview = lines.map((line) => line.split(",").map((cell) => cell.trim()));
      setCsvPreview(preview);

      // Extract columns and create source fields
      if (preview.length > 0) {
        const headers = preview[0];
        const fields: TSourceField[] = headers.map((header) => ({
          id: header,
          name: header,
          type: "string",
          sampleValue: preview[1]?.[headers.indexOf(header)] || "",
        }));
        onSourceFieldsChange(fields);
        setShowMapping(true);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      processCSVFile(file);
    }
  };

  const handleLoadSample = () => {
    onLoadSampleCSV();
    setShowMapping(true);
  };

  // If mapping is shown, show the mapping UI
  if (showMapping && sourceFields.length > 0) {
    return (
      <div className="space-y-4">
        {/* File info bar */}
        {csvFile && (
          <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-2">
            <div className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">{csvFile.name}</span>
              <Badge text={`${csvPreview.length - 1} rows`} type="success" size="tiny" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCsvFile(null);
                setCsvPreview([]);
                setShowMapping(false);
                onSourceFieldsChange([]);
              }}>
              Change file
            </Button>
          </div>
        )}

        {/* CSV Preview Table */}
        {csvPreview.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {csvPreview[0]?.map((header, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-slate-700">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.slice(1, 4).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-slate-100">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 text-slate-600">
                          {cell || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvPreview.length > 4 && (
              <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-center text-xs text-slate-500">
                Showing 3 of {csvPreview.length - 1} rows
              </div>
            )}
          </div>
        )}

        {/* Mapping UI */}
        <MappingUI
          sourceFields={sourceFields}
          mappings={mappings}
          onMappingsChange={onMappingsChange}
          sourceType="csv"
        />
      </div>
    );
  }

  // Upload and S3 setup UI
  return (
    <div className="space-y-6">
      {/* Manual Upload Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-slate-700">Upload CSV File</h4>
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6">
          <label
            htmlFor="csv-file-upload"
            className="flex cursor-pointer flex-col items-center justify-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}>
            <ArrowUpFromLineIcon className="h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="mt-1 text-xs text-slate-400">CSV files only</p>
            <input
              type="file"
              id="csv-file-upload"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
        <div className="flex justify-between">
          <Button variant="secondary" size="sm" onClick={handleLoadSample}>
            Load sample CSV
          </Button>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* S3 Integration Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CloudIcon className="h-5 w-5 text-slate-500" />
          <h4 className="text-sm font-medium text-slate-700">S3 Bucket Integration</h4>
          <Badge text="Automated" type="gray" size="tiny" />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-4 text-sm text-slate-600">
            Drop CSV files into your S3 bucket to automatically import feedback. Files are processed every 15
            minutes.
          </p>

          {/* S3 Path Display */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Drop zone path</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-slate-100 px-3 py-2 font-mono text-sm text-slate-700">
                  {s3Path}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyS3Path}>
                  <CopyIcon className="h-4 w-4" />
                  {s3Copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            {/* S3 Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">AWS Region</Label>
                <Select defaultValue="eu-central-1">
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                    <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                    <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                    <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                    <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Processing interval</Label>
                <Select defaultValue="15">
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Every 5 minutes</SelectItem>
                    <SelectItem value="15">Every 15 minutes</SelectItem>
                    <SelectItem value="30">Every 30 minutes</SelectItem>
                    <SelectItem value="60">Every hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Auto-sync toggle */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-slate-900">Enable auto-sync</span>
                <span className="text-xs text-slate-500">
                  Automatically process new files dropped in the bucket
                </span>
              </div>
              <Switch checked={s3AutoSync} onCheckedChange={setS3AutoSync} />
            </div>

            {/* IAM Instructions */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <SettingsIcon className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800">IAM Configuration Required</p>
                  <p className="mt-1 text-xs text-amber-700">
                    Add the Formbricks IAM role to your S3 bucket policy to enable access.{" "}
                    <button type="button" className="font-medium underline hover:no-underline">
                      View setup guide →
                    </button>
                  </p>
                </div>
              </div>
            </div>

            {/* Test Connection */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-2">
                <RefreshCwIcon className="h-4 w-4" />
                Test connection
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
