"use client";

import { QUESTIONS_ICON_MAP } from "@/app/lib/questions";
import { ColumnDef } from "@tanstack/react-table";
import { CircleHelpIcon, EyeOffIcon, MailIcon, TagIcon } from "lucide-react";
import Link from "next/link";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { getPersonIdentifier } from "@formbricks/lib/person/utils";
import { processResponseData } from "@formbricks/lib/responses";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
import { TResponseTableData } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import { Checkbox } from "@formbricks/ui/Checkbox";
import { ResponseBadges } from "@formbricks/ui/ResponseBadges";
import { RenderResponse } from "@formbricks/ui/SingleResponseCard/components/RenderResponse";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

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

const getQuestionColumnsData = (
  question: TSurveyQuestion,
  survey: TSurvey,
  isExpanded: boolean
): ColumnDef<TResponseTableData>[] => {
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
            const responseValue = row.original.responseData[matrixRow.default];
            if (typeof responseValue === "string") {
              return <p className="text-slate-900">{responseValue}</p>;
            }
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
            const responseValue = row.original.responseData[addressField];
            if (typeof responseValue === "string") {
              return <p className="text-slate-900">{responseValue}</p>;
            }
          },
        };
      });

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
            const responseValue = row.original.responseData[question.id];
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
): ColumnDef<TResponseTableData>[] => {
  const questionColumns = survey.questions.flatMap((question) =>
    getQuestionColumnsData(question, survey, isExpanded)
  );
  const selectionColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "select",
    size: 75,
    enableResizing: false,
    header: ({ table }) => (
      <div className="flex w-full items-center justify-center pr-4">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
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

  const dateColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "createdAt",
    header: () => "Date",
    size: 200,
    cell: ({ row }) => {
      const isoDateString = row.original.createdAt;
      const date = new Date(isoDateString);

      const formattedDate = date.toLocaleString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const formattedTime = date.toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      return (
        <div>
          <p className="text-slate-900">{formattedDate}</p>
          <p className="text-slate-900">{formattedTime}</p>
        </div>
      );
    },
  };

  const personColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "personId",
    header: () => (
      <div className="flex items-center gap-x-1.5">
        Person
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger>
              <CircleHelpIcon className="h-3 w-3 text-slate-500" strokeWidth={1.5} />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-normal">
              How to identify users for{" "}
              <Link
                className="underline underline-offset-2 hover:text-slate-900"
                href="https://formbricks.com/docs/link-surveys/user-identification"
                target="_blank">
                link surveys
              </Link>{" "}
              or{" "}
              <Link
                className="underline underline-offset-2 hover:text-slate-900"
                href="https://formbricks.com/docs/app-surveys/user-identification"
                target="_blank">
                in-app surveys.
              </Link>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    ),
    size: 275,
    cell: ({ row }) => {
      const personId = row.original.person
        ? getPersonIdentifier(row.original.person, row.original.personAttributes)
        : "Anonymous";
      return <p className="truncate text-slate-900">{personId}</p>;
    },
  };

  const statusColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "status",
    size: 200,
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      return <ResponseBadges items={[status]} />;
    },
  };

  const tagsColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const tags = row.original.tags;
      if (Array.isArray(tags)) {
        const tagsArray = tags.map((tag) => tag.name);
        return (
          <ResponseBadges
            items={tagsArray}
            isExpanded={isExpanded}
            icon={<TagIcon className="h-4 w-4 text-slate-500" />}
          />
        );
      }
    },
  };

  const notesColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "notes",
    header: "Notes",
    cell: ({ row }) => {
      const notes = row.original.notes;
      if (Array.isArray(notes)) {
        const notesArray = notes.map((note) => note.text);
        return processResponseData(notesArray);
      }
    },
  };

  const hiddenFieldColumns: ColumnDef<TResponseTableData>[] = survey.hiddenFields.fieldIds
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
          cell: ({ row }) => {
            const hiddenFieldResponse = row.original.responseData[hiddenFieldId];
            if (typeof hiddenFieldResponse === "string") {
              return <div className="text-slate-900">{hiddenFieldResponse}</div>;
            }
          },
        };
      })
    : [];

  const verifiedEmailColumn: ColumnDef<TResponseTableData> = {
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
    personColumn,
    dateColumn,
    statusColumn,
    ...(survey.isVerifyEmailEnabled ? [verifiedEmailColumn] : []),
    ...questionColumns,
    ...hiddenFieldColumns,
    tagsColumn,
    notesColumn,
  ];
};
