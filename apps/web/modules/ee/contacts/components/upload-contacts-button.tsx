"use client";

import { cn } from "@/lib/cn";
import { isStringMatch } from "@/lib/utils/helper";
import { createContactsFromCSVAction } from "@/modules/ee/contacts/actions";
import { CsvTable } from "@/modules/ee/contacts/components/csv-table";
import { UploadContactsAttributes } from "@/modules/ee/contacts/components/upload-contacts-attribute";
import { TContactCSVUploadResponse, ZContactCSVUploadResponse } from "@/modules/ee/contacts/types/contact";
import { Button } from "@/modules/ui/components/button";
import { Modal } from "@/modules/ui/components/modal";
import { StylingTabs } from "@/modules/ui/components/styling-tabs";
import { useTranslate } from "@tolgee/react";
import { parse } from "csv-parse/sync";
import { ArrowUpFromLineIcon, CircleAlertIcon, FileUpIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";

interface UploadContactsCSVButtonProps {
  environmentId: string;
  contactAttributeKeys: TContactAttributeKey[];
}

export const UploadContactsCSVButton = ({
  environmentId,
  contactAttributeKeys,
}: UploadContactsCSVButtonProps) => {
  const { t } = useTranslate();
  const router = useRouter();

  const errorContainerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [duplicateContactsAction, setDuplicateContactsAction] = useState<"skip" | "update" | "overwrite">(
    "skip"
  );
  const [csvResponse, setCSVResponse] = useState<TContactCSVUploadResponse>([]);
  const [attributeMap, setAttributeMap] = useState<Record<string, string>>({});
  const [error, setErrror] = useState("");
  const [loading, setLoading] = useState(false);

  const processCSVFile = async (file: File) => {
    if (!file) return;

    // Check file type
    if (!file.type && !file.name.endsWith(".csv")) {
      setErrror("Please upload a CSV file");
      return;
    }

    if (file.type && file.type !== "text/csv" && !file.type.includes("csv")) {
      setErrror("Please upload a CSV file");
      return;
    }

    // Max file size check (800KB)
    const maxSizeInBytes = 800 * 1024;
    if (file.size > maxSizeInBytes) {
      setErrror("File size exceeds the maximum limit of 800KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      setErrror("");
      const csv = e.target?.result as string;

      try {
        const records = parse(csv, {
          columns: true, // Parse the header as column names
          skip_empty_lines: true, // Skip empty lines
        });

        const parsedRecords = ZContactCSVUploadResponse.safeParse(records);
        if (!parsedRecords.success) {
          console.error("Error parsing CSV:", parsedRecords.error);
          setErrror(parsedRecords.error.errors[0].message);
          return;
        }

        if (!parsedRecords.data.length) {
          setErrror(
            "The uploaded CSV file does not contain any valid contacts, please see the sample CSV file for the correct format."
          );
          return;
        }

        setCSVResponse(parsedRecords.data);
      } catch (error) {
        console.error("Error parsing CSV:", error);
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

  const csvColumns = useMemo(() => {
    if (!csvResponse.length) {
      return [];
    }

    // Extract column names (headers) from the first row
    const headers = Object.keys(csvResponse[0]);

    return headers.map((header) => header.trim());
  }, [csvResponse]);

  const resetState = (closeModal?: boolean) => {
    setCSVResponse([]);
    setDuplicateContactsAction("skip");
    setErrror("");
    setAttributeMap({});
    setLoading(false);

    if (closeModal) {
      setOpen(false);
    }
  };

  const handleUpload = async () => {
    if (!csvResponse.length) {
      return;
    }

    setLoading(true);
    setErrror("");

    const values = Object.values(attributeMap);

    if (new Set(values).size !== values.length) {
      const valueCount = values.reduce((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {}) as Record<string, number>;

      const duplicateValues = Object.entries(valueCount)
        .filter(([_, count]) => count > 1)
        .map(([value, _]) => value);

      const duplicateAttributeKeys = Object.entries(attributeMap)
        .filter(([_, value]) => duplicateValues.includes(value))
        .map(([key, _]) => key);

      setErrror(
        `Duplicate mappings found for the following attributes: ${duplicateAttributeKeys.join(", ")}`
      );
      errorContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setLoading(false);
      return;
    }

    const transformedCsvData = csvResponse.map((record) => {
      const newRecord: Record<string, string> = {};
      Object.entries(record).forEach(([key, value]) => {
        // if the key is in the attribute map, we wanna replace it
        if (attributeMap[key]) {
          const attrKeyId = attributeMap[key];
          const attrKey = contactAttributeKeys.find((attrKey) => attrKey.id === attrKeyId);

          if (attrKey) {
            newRecord[attrKey.key] = value;
          } else {
            newRecord[attrKeyId] = value;
          }
        } else {
          newRecord[key] = value;
        }
      });

      return newRecord;
    });

    const result = await createContactsFromCSVAction({
      csvData: transformedCsvData,
      duplicateContactsAction,
      attributeMap,
      environmentId,
    });

    if (result?.data) {
      setErrror("");
      resetState(true);

      router.refresh();
      return;
    }

    if (result?.serverError) {
      setErrror(result.serverError);
    }

    if (result?.validationErrors) {
      if (result.validationErrors.csvData?._errors?.[0]) {
        setErrror(result.validationErrors.csvData._errors?.[0]);
      } else {
        setErrror("An error occurred while uploading the contacts. Please try again later.");
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    const matches: Record<string, string> = {};
    for (const columnName of csvColumns) {
      for (const attributeKey of contactAttributeKeys) {
        if (isStringMatch(columnName, attributeKey.name ?? attributeKey.key)) {
          matches[columnName] = attributeKey.id;
          break;
        }
      }

      if (!matches[columnName]) {
        matches[columnName] = columnName;
      }
    }

    setAttributeMap(matches);
  }, [contactAttributeKeys, csvColumns]);

  useEffect(() => {
    if (error && errorContainerRef.current) {
      errorContainerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  // Function to download an example CSV
  const handleDownloadExampleCSV = () => {
    const exampleData = [
      { email: "user1@example.com", userId: "1001", firstName: "John", lastName: "Doe" },
      { email: "user2@example.com", userId: "1002", firstName: "Jane", lastName: "Smith" },
      { email: "user3@example.com", userId: "1003", firstName: "Mark", lastName: "Jones" },
      { email: "user4@example.com", userId: "1004", firstName: "Emily", lastName: "Brown" },
      { email: "user5@example.com", userId: "1005", firstName: "David", lastName: "Wilson" },
    ];

    const headers = Object.keys(exampleData[0]);
    const csvRows = [headers.join(","), ...exampleData.map((row) => headers.map((h) => row[h]).join(","))];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);

    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "example.csv");
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Only show copy cursor if file is CSV
    const items = Array.from(e.dataTransfer.items);
    const isCSV = items.some(
      (item) => item.type === "text/csv" || (item.type === "" && item.kind === "file") // For when type isn't available
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

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {t("common.upload")} CSV
        <PlusIcon />
      </Button>
      <Modal
        open={open}
        setOpen={setOpen}
        noPadding
        closeOnOutsideClick={false}
        className="overflow-auto"
        size="xl"
        hideCloseButton>
        <div className="sticky top-0 flex h-full flex-col rounded-lg">
          <button
            className={cn(
              "absolute top-0 right-0 hidden pt-4 pr-4 text-slate-400 hover:text-slate-500 focus:ring-0 focus:outline-none sm:block"
            )}
            onClick={() => {
              resetState(true);
            }}>
            <XIcon className="h-6 w-6 rounded-md bg-white" />
            <span className="sr-only">Close</span>
          </button>
          <div className="rounded-t-lg bg-slate-100">
            <div className="flex w-full items-center justify-between p-6">
              <div className="flex items-center space-x-2">
                <div className="mr-1.5 h-6 w-6 text-slate-500">
                  <FileUpIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xl font-medium text-slate-700">{t("common.upload")} CSV</div>
                  <div className="text-sm text-slate-500">
                    {t("environments.contacts.upload_contacts_modal_description")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div
            className="mx-6 my-4 flex items-center gap-2 rounded-md border-2 border-red-200 bg-red-50 p-4"
            ref={errorContainerRef}>
            <CircleAlertIcon className="text-red-600" />
            <p className="text-red-600">{error}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-8 px-6 py-4">
          <div className="flex flex-col gap-2">
            <div className="no-scrollbar max-h-[400px] overflow-auto rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4">
              {!csvResponse.length ? (
                <div>
                  <label
                    htmlFor="file"
                    className={cn(
                      "relative flex cursor-pointer flex-col items-center justify-center rounded-lg hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                    )}
                    onDragOver={(e) => handleDragOver(e)}
                    onDrop={(e) => handleDrop(e)}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ArrowUpFromLineIcon className="h-6 text-slate-500" />
                      <p className={cn("mt-2 text-center text-sm text-slate-500")}>
                        <span className="font-semibold">{t("common.upload_input_description")}</span>
                      </p>
                      <input
                        type="file"
                        id={"file"}
                        name={"file"}
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </div>
                  </label>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-8">
                  <h3 className="font-medium text-slate-500">
                    {t("environments.contacts.upload_contacts_modal_preview")}
                  </h3>
                  <div className="h-[300px] w-full overflow-auto rounded-md border border-slate-300">
                    <CsvTable data={[...csvResponse.slice(0, 11)]} />
                  </div>
                </div>
              )}
            </div>
            {!csvResponse.length && (
              <div className="flex justify-start">
                <Button onClick={handleDownloadExampleCSV} variant="secondary">
                  {t("environments.contacts.upload_contacts_modal_download_example_csv")}
                </Button>
              </div>
            )}
          </div>

          {csvResponse.length > 0 ? (
            <div className="flex flex-col">
              <h3 className="font-medium text-slate-900">
                {t("environments.contacts.upload_contacts_modal_attributes_title")}
              </h3>
              <p className="mb-2 text-slate-500">
                {t("environments.contacts.upload_contacts_modal_attributes_description")}
              </p>

              <div className="flex flex-col gap-2">
                {csvColumns.map((column, index) => {
                  return (
                    <UploadContactsAttributes
                      key={index}
                      csvColumn={column}
                      attributeMap={attributeMap}
                      setAttributeMap={setAttributeMap}
                      contactAttributeKeys={contactAttributeKeys}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col">
            <h3 className="font-medium text-slate-900">
              {t("environments.contacts.upload_contacts_modal_duplicates_title")}
            </h3>
            <p className="mb-2 text-slate-500">
              {t("environments.contacts.upload_contacts_modal_duplicates_description")}
            </p>
            <StylingTabs
              id="duplicate-contacts"
              options={[
                {
                  value: "skip",
                  label: t("environments.contacts.upload_contacts_modal_duplicates_skip_title"),
                },
                {
                  value: "update",
                  label: t("environments.contacts.upload_contacts_modal_duplicates_update_title"),
                },
                {
                  value: "overwrite",
                  label: t("environments.contacts.upload_contacts_modal_duplicates_overwrite_title"),
                },
              ]}
              defaultSelected={duplicateContactsAction}
              onChange={(value) => setDuplicateContactsAction(value)}
              className="max-w-[400px]"
              tabsContainerClassName="p-1 rounded-lg"
            />

            <div className="mt-1">
              <p className="text-sm font-medium text-slate-500">
                {duplicateContactsAction === "skip" &&
                  t("environments.contacts.upload_contacts_modal_duplicates_skip_description")}
                {duplicateContactsAction === "update" &&
                  t("environments.contacts.upload_contacts_modal_duplicates_update_description")}
                {duplicateContactsAction === "overwrite" &&
                  t("environments.contacts.upload_contacts_modal_duplicates_overwrite_description")}
              </p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 w-full bg-white">
          <div className="flex justify-end rounded-b-lg p-4">
            {csvResponse.length > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  resetState();
                }}
                className="mr-2">
                {t("environments.contacts.upload_contacts_modal_pick_different_file")}
              </Button>
            ) : null}

            <Button
              size="sm"
              onClick={handleUpload}
              loading={loading}
              disabled={loading || !csvResponse.length}>
              {t("environments.contacts.upload_contacts_modal_upload_btn")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
