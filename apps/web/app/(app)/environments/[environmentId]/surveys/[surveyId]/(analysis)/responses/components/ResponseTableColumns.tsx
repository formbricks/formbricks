"use client";

import { RenderResponse } from "@/modules/analysis/components/SingleResponseCard/components/RenderResponse";
import { ColumnDef } from "@tanstack/react-table";
import { CircleHelpIcon, EyeOffIcon, MailIcon, TagIcon } from "lucide-react";
import Link from "next/link";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { getPersonIdentifier } from "@formbricks/lib/person/utils";
import { processResponseData } from "@formbricks/lib/responses";
import { QUESTIONS_ICON_MAP, VARIABLES_ICON_MAP } from "@formbricks/lib/utils/questions";
import { recallToHeadline } from "@formbricks/lib/utils/recall";
import { TResponseTableData } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import { getSelectionColumn } from "@formbricks/ui/components/DataTable";
import { ResponseBadges } from "@formbricks/ui/components/ResponseBadges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/components/Tooltip";

const getAddressFieldLabel = (field: string, t: (key: string) => string) => {
  switch (field) {
    case "addressLine1":
      return t("environments.surveys.responses.address_line_1");
    case "addressLine2":
      return t("environments.surveys.responses.address_line_2");
    case "city":
      return t("environments.surveys.responses.city");
    case "state":
      return t("environments.surveys.responses.state_region");
    case "zip":
      return t("environments.surveys.responses.zip_post_code");
    case "country":
      return t("environments.surveys.responses.country");

    default:
      break;
  }
};

const getContactInfoFieldLabel = (field: string, t: (key: string) => string) => {
  switch (field) {
    case "firstName":
      return t("environments.surveys.responses.first_name");
    case "lastName":
      return t("environments.surveys.responses.last_name");
    case "email":
      return t("environments.surveys.responses.email");
    case "phone":
      return t("environments.surveys.responses.phone");
    case "company":
      return t("environments.surveys.responses.company");
    default:
      break;
  }
};

const getQuestionColumnsData = (
  question: TSurveyQuestion,
  survey: TSurvey,
  isExpanded: boolean,
  t: (key: string) => string
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
                  <span className="truncate">{getAddressFieldLabel(addressField, t)}</span>
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

    case "contactInfo":
      const contactInfoFields = ["firstName", "lastName", "email", "phone", "company"];
      return contactInfoFields.map((contactInfoField) => {
        return {
          accessorKey: contactInfoField,
          header: () => {
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <span className="h-4 w-4">{QUESTIONS_ICON_MAP["contactInfo"]}</span>
                  <span className="truncate">{getContactInfoFieldLabel(contactInfoField, t)}</span>
                </div>
              </div>
            );
          },
          cell: ({ row }) => {
            const responseValue = row.original.responseData[contactInfoField];
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

export const generateResponseTableColumns = (
  survey: TSurvey,
  isExpanded: boolean,
  isReadOnly: boolean,
  t: (key: string) => string
): ColumnDef<TResponseTableData>[] => {
  const questionColumns = survey.questions.flatMap((question) =>
    getQuestionColumnsData(question, survey, isExpanded, t)
  );

  const dateColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "createdAt",
    header: () => t("common.date"),
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
        {t("common.person")}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger>
              <CircleHelpIcon className="h-3 w-3 text-slate-500" strokeWidth={1.5} />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-normal">
              {t("environments.surveys.responses.how_to_identify_users")}
              <Link
                className="underline underline-offset-2 hover:text-slate-900"
                href="https://formbricks.com/docs/link-surveys/user-identification"
                target="_blank">
                {t("common.link_surveys")}
              </Link>{" "}
              or{" "}
              <Link
                className="underline underline-offset-2 hover:text-slate-900"
                href="https://formbricks.com/docs/app-surveys/user-identification"
                target="_blank">
                {t("common.app_survey")}
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
        : t("common.anonymous");
      return <p className="truncate text-slate-900">{personId}</p>;
    },
  };

  const statusColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "status",
    size: 200,
    header: t("common.status"),
    cell: ({ row }) => {
      const status = row.original.status;
      return <ResponseBadges items={[status]} />;
    },
  };

  const tagsColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "tags",
    header: t("common.tags"),
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
    header: t("common.notes"),
    cell: ({ row }) => {
      const notes = row.original.notes;
      if (Array.isArray(notes)) {
        const notesArray = notes.map((note) => note.text);
        return processResponseData(notesArray);
      }
    },
  };

  const variableColumns: ColumnDef<TResponseTableData>[] = survey.variables.map((variable) => {
    return {
      accessorKey: variable.id,
      header: () => (
        <div className="flex items-center space-x-2 overflow-hidden">
          <span className="h-4 w-4">{VARIABLES_ICON_MAP[variable.type]}</span>
          <span className="truncate">{variable.name}</span>
        </div>
      ),
      cell: ({ row }) => {
        const variableResponse = row.original.variables[variable.id];
        if (typeof variableResponse === "string" || typeof variableResponse === "number") {
          return <div className="text-slate-900">{variableResponse}</div>;
        }
      },
    };
  });

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
        <span className="truncate">{t("common.verified_email")}</span>
      </div>
    ),
  };

  // Combine the selection column with the dynamic question columns

  const baseColumns = [
    personColumn,
    dateColumn,
    statusColumn,
    ...(survey.isVerifyEmailEnabled ? [verifiedEmailColumn] : []),
    ...questionColumns,
    ...variableColumns,
    ...hiddenFieldColumns,
    tagsColumn,
    notesColumn,
  ];

  return isReadOnly ? baseColumns : [getSelectionColumn(), ...baseColumns];
};
