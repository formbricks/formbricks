"use client";

import { QUESTIONS_ICON_MAP } from "@/app/lib/questions";
import { ColumnDef } from "@tanstack/react-table";
import { EyeOffIcon, MailIcon } from "lucide-react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
import { TResponseNote } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import { Checkbox } from "@formbricks/ui/Checkbox";
import { ResponseBadges } from "@formbricks/ui/ResponseBadges";
import { RenderResponse } from "@formbricks/ui/SingleResponseCard/components/RenderResponse";

export interface TTableData {
  responseId: string;
  createdAt: Date;
  status: string;
  verifiedEmail: string;
  tags: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    environmentId: string;
  }[];
  notes: TResponseNote[];
  language: string | null;
}

const getAddressFieldLabel = (field: string) => {
  switch (field) {
    case "addressLine1":
      return "Address Line 1";
    case "addressLine2":
      return "Address Line 2";
    case "city":
      return "City / Town";
    case "state":
      return "State / Region";
    case "zip":
      return "ZIP / Post code";
    case "country":
      return "Country";

    default:
      break;
  }
};

const getColumnHeaderForQuestion = (
  question: TSurveyQuestion,
  survey: TSurvey,
  isExpanded: boolean
): ColumnDef<TTableData>[] => {
  switch (question.type) {
    case "matrix":
      return question.rows.map((matrixRow) => {
        return {
          accessorKey: matrixRow.default,
          header: () => {
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <span className="h-4 w-4">{QUESTIONS_ICON_MAP["matrix"]}</span>
                  <span className="truncate">{getLocalizedValue(matrixRow, "default")}</span>
                </div>
              </div>
            );
          },
          cell: ({ row }) => {
            const responseValue = row.original[matrixRow.default];
            return <p>{responseValue}</p>;
          },
        };
      });

    case "address":
      const addressFields = ["addressLine1", "addressLine2", "city", "state", "zip", "country"];
      return addressFields.map((addressField) => {
        return {
          accessorKey: addressField,
          header: () => {
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <span className="h-4 w-4">{QUESTIONS_ICON_MAP["address"]}</span>
                  <span className="truncate">{getAddressFieldLabel(addressField)}</span>
                </div>
              </div>
            );
          },
          cell: ({ row }) => {
            const responseValue = row.original[addressField];
            return <p>{responseValue}</p>;
          },
        };
      });

    case "consent":
    case "nps":
    case "cta":
    case "multipleChoiceMulti":
    case "multipleChoiceSingle":
      return [
        {
          accessorKey: question.id,
          header: () => (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 overflow-hidden">
                <span className="h-4 w-4">{QUESTIONS_ICON_MAP[question.type]}</span>
                <span className="truncate">
                  {getLocalizedValue(
                    recallToHeadline(question.headline, survey, false, "default", []),
                    "default"
                  )}
                </span>
              </div>
            </div>
          ),
          cell: ({ row }) => {
            const responseValue = row.original[question.id];
            const language = row.original.language;
            if (typeof responseValue === "string" || typeof responseValue === "number") {
              return <ResponseBadges items={[responseValue.toString()]} isExpanded={isExpanded} />;
            } else if (Array.isArray(responseValue)) {
              return <ResponseBadges items={responseValue} isExpanded={isExpanded} />;
            } else {
              return (
                <RenderResponse
                  question={question}
                  survey={survey}
                  responseData={responseValue}
                  language={language}
                  isExpanded={isExpanded}
                />
              );
            }
          },
        },
      ];

    default:
      return [
        {
          accessorKey: question.id,
          header: () => (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 overflow-hidden">
                <span className="h-4 w-4">{QUESTIONS_ICON_MAP[question.type]}</span>
                <span className="truncate">
                  {getLocalizedValue(
                    recallToHeadline(question.headline, survey, false, "default", []),
                    "default"
                  )}
                </span>
              </div>
            </div>
          ),
          cell: ({ row }) => {
            const responseValue = row.original[question.id];
            const language = row.original.language;
            return (
              <RenderResponse
                question={question}
                survey={survey}
                responseData={responseValue}
                language={language}
                isExpanded={isExpanded}
              />
            );
          },
        },
      ];
  }
};

export const generateColumns = (
  survey: TSurvey,
  isExpanded: boolean,
  isViewer: boolean
): ColumnDef<TTableData>[] => {
  const questionColumns = survey.questions.flatMap((question) =>
    getColumnHeaderForQuestion(question, survey, isExpanded)
  );
  const selectionColumn: ColumnDef<TTableData> = {
    accessorKey: "select",
    size: 75,
    enableResizing: false,
    header: ({ table }) => (
      <div className="flex w-full items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex w-full items-center justify-center pr-4">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="mx-1"
        />
      </div>
    ),
  };

  const dateColumn: ColumnDef<TTableData> = {
    accessorKey: "createdAt", // Use the correct key where the date is stored in your response data
    header: () => <span>Date</span>,
    cell: ({ row }) => {
      const isoDateString = row.original.createdAt; // Get the ISO date string
      const date = new Date(isoDateString); // Convert string to Date object

      // Format the date as 'YYYY/MM/DD' (you can adjust the format as needed)
      const formattedDate = date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      // Format the time as 'HH:MM AM/PM' (12-hour clock format)
      const formattedTime = date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      return (
        <div>
          <p>{formattedDate}</p>
          <p>{formattedTime}</p>
        </div>
      );
    },
  };

  const statusColumn: ColumnDef<TTableData> = {
    accessorKey: "status",
    header: () => <span>Status</span>,
    cell: ({ row }) => {
      const status = row.original.status;
      return <ResponseBadges items={[status]} />;
    },
  };

  const tagsColumn: ColumnDef<TTableData> = {
    accessorKey: "tags",
    header: () => <span>Tags</span>,
    cell: ({ getValue }) => {
      const tags = getValue(); // Get the ISO date string
      if (Array.isArray(tags)) {
        const tagsArray = tags.map((tag) => tag.name);
        return <ResponseBadges items={tagsArray} isExpanded={isExpanded} />;
      }
    },
  };

  const notesColumn: ColumnDef<TTableData> = {
    accessorKey: "notes",
    header: () => <span>Notes</span>,
    cell: ({ getValue }) => {
      const notes = getValue();
      if (Array.isArray(notes)) {
        const notesArray = notes.map((note) => note.text);
        return <ResponseBadges items={notesArray} isExpanded={isExpanded} />;
      }
    },
  };

  const hiddenFieldColumns: ColumnDef<TTableData>[] = survey.hiddenFields.fieldIds
    ? survey.hiddenFields.fieldIds.map((hiddenFieldId) => {
        return {
          accessorKey: hiddenFieldId,
          header: () => (
            <div className="flex items-center space-x-2 overflow-hidden">
              <span className="h-4 w-4">
                <EyeOffIcon className="h-4 w-4" />
              </span>
              <span className="truncate">{hiddenFieldId}</span>
            </div>
          ),
          cell: ({ getValue }) => {
            const hiddenFieldResponse = getValue();
            if (typeof hiddenFieldResponse === "string") {
              return <div>{hiddenFieldResponse}</div>;
            }
          },
        };
      })
    : [];

  const verifiedEmailColumn: ColumnDef<TTableData> = {
    accessorKey: "verifiedEmail",
    header: () => (
      <div className="flex items-center space-x-2 overflow-hidden">
        <span className="h-4 w-4">
          <MailIcon className="h-4 w-4" />
        </span>
        <span className="truncate">Verified Email</span>
      </div>
    ),
  };

  // Combine the selection column with the dynamic question columns
  return [
    ...(isViewer ? [] : [selectionColumn]),
    dateColumn,
    statusColumn,
    ...(survey.isVerifyEmailEnabled ? [verifiedEmailColumn] : []),
    ...questionColumns,
    ...hiddenFieldColumns,
    tagsColumn,
    notesColumn,
  ];
};
