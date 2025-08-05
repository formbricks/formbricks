"use client";

import { getLocalizedValue } from "@/lib/i18n/utils";
import { extractChoiceIdsFromResponse } from "@/lib/response/utils";
import { processResponseData } from "@/lib/responses";
import { getContactIdentifier } from "@/lib/utils/contact";
import { getFormattedDateTimeString } from "@/lib/utils/datetime";
import { recallToHeadline } from "@/lib/utils/recall";
import { RenderResponse } from "@/modules/analysis/components/SingleResponseCard/components/RenderResponse";
import { VARIABLES_ICON_MAP, getQuestionIconMap } from "@/modules/survey/lib/questions";
import { getSelectionColumn } from "@/modules/ui/components/data-table";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { ResponseBadges } from "@/modules/ui/components/response-badges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { cn } from "@/modules/ui/lib/utils";
import { ColumnDef } from "@tanstack/react-table";
import { TFnType } from "@tolgee/react";
import { CircleHelpIcon, EyeOffIcon, MailIcon, TagIcon } from "lucide-react";
import Link from "next/link";
import { TResponseTableData } from "@formbricks/types/responses";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";

const getAddressFieldLabel = (field: string, t: TFnType) => {
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

const getContactInfoFieldLabel = (field: string, t: TFnType) => {
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
  t: TFnType
): ColumnDef<TResponseTableData>[] => {
  const QUESTIONS_ICON_MAP = getQuestionIconMap(t);

  // Helper function to create consistent column headers
  const createQuestionHeader = (questionType: string, headline: string, suffix?: string) => {
    const title = suffix ? `${headline} - ${suffix}` : headline;
    const QuestionHeader = () => (
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 overflow-hidden">
          <span className="h-4 w-4">{QUESTIONS_ICON_MAP[questionType]}</span>
          <span className="truncate">{title}</span>
        </div>
      </div>
    );
    QuestionHeader.displayName = "QuestionHeader";
    return QuestionHeader;
  };

  // Helper function to get localized question headline
  const getQuestionHeadline = (question: TSurveyQuestion, survey: TSurvey) => {
    return getLocalizedValue(recallToHeadline(question.headline, survey, false, "default"), "default");
  };

  // Helper function to render choice ID badges
  const renderChoiceIdBadges = (choiceIds: string[], isExpanded: boolean) => {
    if (choiceIds.length === 0) return null;

    const containerClasses = cn("flex gap-x-1 w-full", isExpanded && "flex-wrap gap-y-1");

    return (
      <div className={containerClasses}>
        {choiceIds.map((choiceId, index) => (
          <IdBadge key={`${choiceId}-${index}`} id={choiceId} />
        ))}
      </div>
    );
  };

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
                  <span className="truncate">
                    {getLocalizedValue(question.headline, "default") +
                      " - " +
                      getLocalizedValue(matrixRow, "default")}
                  </span>
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

    case "multipleChoiceMulti":
    case "multipleChoiceSingle":
    case "ranking":
    case "pictureSelection": {
      const questionHeadline = getQuestionHeadline(question, survey);
      return [
        {
          accessorKey: question.id,
          header: createQuestionHeader(question.type, questionHeadline),
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
                showId={false}
              />
            );
          },
        },
        {
          accessorKey: question.id + "optionIds",
          header: createQuestionHeader(question.type, questionHeadline, t("common.option_id")),
          cell: ({ row }) => {
            const responseValue = row.original.responseData[question.id];
            // Type guard to ensure responseValue is the correct type
            if (typeof responseValue === "string" || Array.isArray(responseValue)) {
              const choiceIds = extractChoiceIdsFromResponse(
                responseValue,
                question,
                row.original.language || undefined
              );
              return renderChoiceIdBadges(choiceIds, isExpanded);
            }
            return null;
          },
        },
      ];
    }

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
                    recallToHeadline(question.headline, survey, false, "default"),
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
                showId={false}
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
  t: TFnType
): ColumnDef<TResponseTableData>[] => {
  const questionColumns = survey.questions.flatMap((question) =>
    getQuestionColumnsData(question, survey, isExpanded, t)
  );

  const dateColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "createdAt",
    header: () => t("common.date"),
    size: 200,
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);
      return <p className="text-slate-900">{getFormattedDateTimeString(date)}</p>;
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
        ? getContactIdentifier(row.original.person, row.original.contactAttributes)
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
      return <ResponseBadges items={[{ value: status }]} showId={false} />;
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
            items={tagsArray.map((tag) => ({ value: tag }))}
            isExpanded={isExpanded}
            icon={<TagIcon className="h-4 w-4 text-slate-500" />}
            showId={false}
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
