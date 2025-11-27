"use client";

import { ColumnDef } from "@tanstack/react-table";
import { TFunction } from "i18next";
import { CircleHelpIcon, EyeOffIcon, MailIcon, TagIcon } from "lucide-react";
import Link from "next/link";
import { TResponseTableData } from "@formbricks/types/responses";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { extractChoiceIdsFromResponse } from "@/lib/response/utils";
import { getContactIdentifier } from "@/lib/utils/contact";
import { getFormattedDateTimeString } from "@/lib/utils/datetime";
import { recallToHeadline } from "@/lib/utils/recall";
import { RenderResponse } from "@/modules/analysis/components/SingleResponseCard/components/RenderResponse";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { VARIABLES_ICON_MAP, getElementIconMap } from "@/modules/survey/lib/elements";
import { getSelectionColumn } from "@/modules/ui/components/data-table";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { ResponseBadges } from "@/modules/ui/components/response-badges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { cn } from "@/modules/ui/lib/utils";
import {
  COLUMNS_ICON_MAP,
  METADATA_FIELDS,
  getAddressFieldLabel,
  getContactInfoFieldLabel,
  getMetadataFieldLabel,
  getMetadataValue,
} from "../lib/utils";

const getElementColumnsData = (
  element: TSurveyElement,
  survey: TSurvey,
  isExpanded: boolean,
  t: TFunction
): ColumnDef<TResponseTableData>[] => {
  const ELEMENTS_ICON_MAP = getElementIconMap(t);
  const addressFields = ["addressLine1", "addressLine2", "city", "state", "zip", "country"];
  const contactInfoFields = ["firstName", "lastName", "email", "phone", "company"];

  // Helper function to create consistent column headers
  const createElementHeader = (elementType: string, headline: string, suffix?: string) => {
    const title = suffix ? `${headline} - ${suffix}` : headline;
    const ElementHeader = () => (
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 overflow-hidden">
          <span className="h-4 w-4">{ELEMENTS_ICON_MAP[elementType]}</span>
          <span className="truncate">{title}</span>
        </div>
      </div>
    );
    return ElementHeader;
  };

  const getElementHeadline = (element: TSurveyElement, survey: TSurvey) => {
    return getTextContent(
      getLocalizedValue(recallToHeadline(element.headline, survey, false, "default"), "default")
    );
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

  switch (element.type) {
    case "matrix":
      return element.rows.map((matrixRow) => {
        return {
          accessorKey: "ELEMENT_" + element.id + "_" + matrixRow.label.default,
          header: () => {
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <span className="h-4 w-4">{ELEMENTS_ICON_MAP["matrix"]}</span>
                  <span className="truncate">
                    {getTextContent(getLocalizedValue(element.headline, "default")) +
                      " - " +
                      getLocalizedValue(matrixRow.label, "default")}
                  </span>
                </div>
              </div>
            );
          },
          cell: ({ row }) => {
            const responseValue = row.original.responseData[matrixRow.label.default];
            if (typeof responseValue === "string") {
              return <p className="text-slate-900">{responseValue}</p>;
            }
          },
        };
      });

    case "address":
      return addressFields.map((addressField) => {
        return {
          accessorKey: "ELEMENT_" + element.id + "_" + addressField,
          header: () => {
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <span className="h-4 w-4">{ELEMENTS_ICON_MAP["address"]}</span>
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
      return contactInfoFields.map((contactInfoField) => {
        return {
          accessorKey: "ELEMENT_" + element.id + "_" + contactInfoField,
          header: () => {
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <span className="h-4 w-4">{ELEMENTS_ICON_MAP["contactInfo"]}</span>
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
      const elementHeadline = getElementHeadline(element, survey);
      return [
        {
          accessorKey: "ELEMENT_" + element.id,
          header: createElementHeader(element.type, elementHeadline),
          cell: ({ row }) => {
            const responseValue = row.original.responseData[element.id];
            const language = row.original.language;
            return (
              <RenderResponse
                element={element}
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
          accessorKey: "ELEMENT_" + element.id + "optionIds",
          header: createElementHeader(element.type, elementHeadline, t("common.option_id")),
          cell: ({ row }) => {
            const responseValue = row.original.responseData[element.id];
            // Type guard to ensure responseValue is the correct type
            if (typeof responseValue === "string" || Array.isArray(responseValue)) {
              const choiceIds = extractChoiceIdsFromResponse(
                responseValue,
                element,
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
          accessorKey: "ELEMENT_" + element.id,
          header: () => (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 overflow-hidden">
                <span className="h-4 w-4">{ELEMENTS_ICON_MAP[element.type]}</span>
                <span className="truncate">
                  {getTextContent(
                    getLocalizedValue(recallToHeadline(element.headline, survey, false, "default"), "default")
                  )}
                </span>
              </div>
            </div>
          ),
          cell: ({ row }) => {
            const responseValue = row.original.responseData[element.id];
            const language = row.original.language;
            return (
              <RenderResponse
                element={element}
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

const getMetadataColumnsData = (t: TFunction): ColumnDef<TResponseTableData>[] => {
  const metadataColumns: ColumnDef<TResponseTableData>[] = [];

  METADATA_FIELDS.forEach((label) => {
    const IconComponent = COLUMNS_ICON_MAP[label];

    metadataColumns.push({
      accessorKey: "METADATA_" + label,
      header: () => (
        <div className="flex items-center space-x-2 overflow-hidden">
          <span className="h-4 w-4">{IconComponent && <IconComponent className="h-4 w-4" />}</span>
          <span className="truncate">{getMetadataFieldLabel(label, t)}</span>
        </div>
      ),
      cell: ({ row }) => {
        const value = getMetadataValue(row.original.meta, label);
        if (value) {
          return <div className="truncate text-slate-900">{value}</div>;
        }
        return null;
      },
    });
  });

  return metadataColumns;
};

export const generateResponseTableColumns = (
  survey: TSurvey,
  isExpanded: boolean,
  isReadOnly: boolean,
  t: TFunction,
  showQuotasColumn: boolean
): ColumnDef<TResponseTableData>[] => {
  const elements = getElementsFromBlocks(survey.blocks);
  const elementColumns = elements.flatMap((element) => getElementColumnsData(element, survey, isExpanded, t));

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
            <TooltipContent side="bottom" className="space-x-1 font-normal">
              <span>{t("environments.surveys.responses.how_to_identify_users")}</span>
              <Link
                className="underline underline-offset-2 hover:text-slate-900"
                href="https://formbricks.com/docs/app-surveys/user-identification"
                target="_blank"
                rel="noopener noreferrer">
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

  const singleUseIdColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "singleUseId",
    header: () => <div className="gap-x-1.5">{t("environments.surveys.responses.single_use_id")}</div>,
    cell: ({ row }) => {
      return <p className="truncate text-slate-900">{row.original.singleUseId}</p>;
    },
  };

  const quotasColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "quota",
    header: t("common.quota"),
    cell: ({ row }) => {
      const quotas = row.original.quotas;
      const items = quotas?.map((quota) => ({ value: quota })) ?? [];
      return <ResponseBadges items={items} showId={false} />;
    },
    size: 200,
  };

  const statusColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "status",
    size: 200,
    header: () => <div className="gap-x-1.5">{t("common.status")}</div>,
    cell: ({ row }) => {
      const status = row.original.status;
      return <ResponseBadges items={[{ value: status }]} showId={false} />;
    },
  };

  const tagsColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "tags",
    header: () => <div className="gap-x-1.5">{t("common.tags")}</div>,
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

  const variableColumns: ColumnDef<TResponseTableData>[] = survey.variables.map((variable) => {
    return {
      accessorKey: "VARIABLE_" + variable.id,
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
          accessorKey: "HIDDEN_FIELD_" + hiddenFieldId,
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

  const metadataColumns = getMetadataColumnsData(t);

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

  // Combine the selection column with the dynamic element columns
  const baseColumns = [
    personColumn,
    singleUseIdColumn,
    dateColumn,
    ...(showQuotasColumn ? [quotasColumn] : []),
    statusColumn,
    ...(survey.isVerifyEmailEnabled ? [verifiedEmailColumn] : []),
    ...elementColumns,
    ...variableColumns,
    ...hiddenFieldColumns,
    ...metadataColumns,
    tagsColumn,
  ];

  return isReadOnly ? baseColumns : [getSelectionColumn(), ...baseColumns];
};
