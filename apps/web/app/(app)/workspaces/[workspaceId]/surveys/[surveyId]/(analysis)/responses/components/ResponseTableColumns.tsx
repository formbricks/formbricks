"use client";

import { ColumnDef } from "@tanstack/react-table";
import { TFunction } from "i18next";
import { CircleHelpIcon, EyeOffIcon, MailIcon, TagIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { labelEmbeddedFields } from "@formbricks/types/embedded-data-label";
import {
  getComputedEmbeddedFields,
  getIngestedEmbeddedFields,
} from "@formbricks/types/embedded-data-resolver";
import { TResponseTableData } from "@formbricks/types/responses";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { TUserLocale } from "@formbricks/types/user";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { extractChoiceIdsFromResponse } from "@/lib/response/utils";
import { getContactIdentifier } from "@/lib/utils/contact";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { recallToHeadline } from "@/lib/utils/recall";
import { RenderResponse } from "@/modules/analysis/components/SingleResponseCard/components/RenderResponse";
import { displayEmbeddedValue } from "@/modules/embedded-data/lib/value-display";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { VARIABLES_ICON_MAP, getElementIconMap } from "@/modules/survey/lib/elements";
import { getSelectionColumn } from "@/modules/ui/components/data-table";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { ResponseBadges } from "@/modules/ui/components/response-badges";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { cn } from "@/modules/ui/lib/utils";
import { isEmptyCellContent, isEmptyResponseValue } from "../lib/empty-cell";
import {
  RESERVED_COLUMN_ENTRIES,
  getAddressFieldLabel,
  getContactInfoFieldLabel,
  getReservedColumnIcon,
  getReservedColumnLabel,
  reservedColumnId,
} from "../lib/utils";

/** What a cell with no value shows, as in every other table. */
const EMPTY_CELL = <span className="text-slate-400">—</span>;

/** A column whose cell shows a dash instead of rendering nothing. */
const withEmptyDash = (column: ColumnDef<TResponseTableData>): ColumnDef<TResponseTableData> => {
  const render = column.cell;
  if (render !== undefined && typeof render !== "function") return column;
  return {
    ...column,
    cell: (context) => {
      // A column without a cell renderer shows its raw value, which may be empty too.
      const content = (render ? render(context) : context.getValue()) as ReactNode;
      return isEmptyCellContent(content) ? EMPTY_CELL : content;
    },
  };
};

const COMPACT_DATE_TIME: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const getElementColumnsData = (
  element: TSurveyElement,
  survey: TSurvey,
  isExpanded: boolean,
  locale: TUserLocale,
  t: TFunction
): ColumnDef<TResponseTableData>[] => {
  const ELEMENTS_ICON_MAP = getElementIconMap(t);
  const addressFields = ["addressLine1", "addressLine2", "city", "state", "zip", "country"];
  const contactInfoFields = ["firstName", "lastName", "email", "phone", "company"];

  // Helper function to create consistent column headers
  const createElementHeader = (elementType: TSurveyElementTypeEnum, headline: string, suffix?: string) => {
    const title = suffix ? `${headline} - ${suffix}` : headline;
    const ElementHeader = () => (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2 overflow-hidden">
          <span className="size-4">{ELEMENTS_ICON_MAP[elementType]}</span>
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
          meta: {
            label: `${getTextContent(getLocalizedValue(element.headline, "default"))} - ${getLocalizedValue(matrixRow.label, "default")}`,
          },
          header: () => {
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-2 overflow-hidden">
                  <span className="size-4">{ELEMENTS_ICON_MAP["matrix"]}</span>
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
          meta: { label: getAddressFieldLabel(addressField, t) },
          header: () => {
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-2 overflow-hidden">
                  <span className="size-4">{ELEMENTS_ICON_MAP["address"]}</span>
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
          meta: { label: getContactInfoFieldLabel(contactInfoField, t) },
          header: () => {
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-2 overflow-hidden">
                  <span className="size-4">{ELEMENTS_ICON_MAP["contactInfo"]}</span>
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
          meta: { label: elementHeadline },
          cell: ({ row }) => {
            const responseValue = row.original.responseData[element.id];
            if (isEmptyResponseValue(responseValue)) return EMPTY_CELL;
            const language = row.original.language;
            return (
              <RenderResponse
                element={element}
                survey={survey}
                responseData={responseValue}
                language={language}
                locale={locale}
                isExpanded={isExpanded}
                showId={false}
              />
            );
          },
        },
        {
          accessorKey: "ELEMENT_" + element.id + "optionIds",
          meta: { label: `${t("common.option_id")}: ${elementHeadline}` },
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
          meta: {
            label: getTextContent(
              getLocalizedValue(recallToHeadline(element.headline, survey, false, "default"), "default")
            ),
          },
          header: () => (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-x-2 overflow-hidden">
                <span className="size-4">{ELEMENTS_ICON_MAP[element.type]}</span>
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
            if (isEmptyResponseValue(responseValue)) return EMPTY_CELL;
            const language = row.original.language;
            return (
              <RenderResponse
                element={element}
                survey={survey}
                responseData={responseValue}
                language={language}
                locale={locale}
                isExpanded={isExpanded}
                showId={false}
                signatureVariant="thumbnail"
              />
            );
          },
        },
      ];
  }
};

/**
 * One column per reserved catalog entry a human would read as data (ENG-2540).
 *
 * Driven by `RESERVED_COLUMN_ENTRIES` rather than a local `METADATA_FIELDS` array, so a catalog
 * addition — ENG-1858's session context, next — becomes a column with no change here. The values are
 * precomputed onto the row (`reservedValues`), so a cell is a lookup rather than a switch that has to
 * know where each field is stored.
 */
const getMetadataColumnsData = (t: TFunction): ColumnDef<TResponseTableData>[] =>
  RESERVED_COLUMN_ENTRIES.map((entry) => {
    const IconComponent = getReservedColumnIcon(entry.name);
    const columnId = reservedColumnId(entry.name);

    return {
      accessorKey: columnId,
      meta: { label: getReservedColumnLabel(entry.name, t) },
      header: () => (
        <div className="flex items-center gap-x-2 overflow-hidden">
          <span className="size-4">{IconComponent && <IconComponent className="h-4 w-4" />}</span>
          <span className="truncate">{getReservedColumnLabel(entry.name, t)}</span>
        </div>
      ),
      cell: ({ row }) => {
        const value = row.original.reservedValues[columnId];
        if (value) {
          return <div className="truncate text-slate-900">{value}</div>;
        }
        return null;
      },
    };
  });

export const generateResponseTableColumns = (
  survey: TSurvey,
  isExpanded: boolean,
  isReadOnly: boolean,
  locale: TUserLocale,
  t: TFunction,
  showQuotasColumn: boolean
): ColumnDef<TResponseTableData>[] => {
  const elements = getElementsFromBlocks(survey.blocks);
  const elementColumns = elements.flatMap((element) =>
    getElementColumnsData(element, survey, isExpanded, locale, t)
  );

  const dateColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "createdAt",
    meta: { label: t("common.date") },
    header: () => t("common.date"),
    size: 200,
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);
      // A short month keeps date and time inside the column; the tooltip carries the long form.
      return (
        <p className="truncate text-slate-900" title={formatDateTimeForDisplay(date, locale)}>
          {formatDateTimeForDisplay(date, locale, COMPACT_DATE_TIME)}
        </p>
      );
    },
  };

  const personColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "personId",
    meta: { label: t("common.person") },
    header: () => (
      <div className="flex items-center gap-x-1.5">
        {t("common.person")}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger>
              <CircleHelpIcon className="size-3 text-slate-500" strokeWidth={1.5} />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="space-x-1 font-normal">
              <span>{t("workspace.surveys.responses.how_to_identify_users")}</span>
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
    meta: { label: t("workspace.surveys.responses.single_use_id") },
    header: () => <div className="gap-x-1.5">{t("workspace.surveys.responses.single_use_id")}</div>,
    cell: ({ row }) => {
      return <p className="truncate text-slate-900">{row.original.singleUseId}</p>;
    },
  };

  const responseIdColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "responseId",
    meta: { label: t("common.response_id") },
    header: () => <div className="gap-x-1.5">{t("common.response_id")}</div>,
    cell: ({ row }) => {
      return <IdBadge id={row.original.responseId} />;
    },
  };

  const quotasColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "quota",
    meta: { label: t("common.quota") },
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
    meta: { label: t("common.status") },
    size: 200,
    header: () => <div className="gap-x-1.5">{t("common.status")}</div>,
    cell: ({ row }) => {
      const status = row.original.status;
      return <ResponseBadges items={[{ value: status }]} showId={false} />;
    },
  };

  const tagsColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "tags",
    meta: { label: t("common.tags") },
    header: () => <div className="gap-x-1.5">{t("common.tags")}</div>,
    cell: ({ row }) => {
      const tags = row.original.tags;
      if (Array.isArray(tags)) {
        const tagsArray = tags.map((tag) => tag.name);
        return (
          <ResponseBadges
            items={tagsArray.map((tag) => ({ value: tag }))}
            isExpanded={isExpanded}
            icon={<TagIcon className="size-4 text-slate-500" />}
            showId={false}
          />
        );
      }
    },
  };

  // ENG-1837: both column groups are built from the survey's Embedded Data definitions. The accessor
  // keys stay the storage keys — they address `row.original.variables` / `responseData`, which are
  // written from the response, not the definitions.
  const variableColumns: ColumnDef<TResponseTableData>[] = getComputedEmbeddedFields(survey).map(
    ({ field, link }) => {
      return {
        accessorKey: "VARIABLE_" + link.storageKey,
        meta: { label: field.name },
        header: () => (
          <div className="flex items-center gap-x-2 overflow-hidden">
            <span className="size-4">
              {VARIABLES_ICON_MAP[field.dataType === "number" ? "number" : "text"]}
            </span>
            <span className="truncate">{field.name}</span>
          </div>
        ),
        cell: ({ row }) => {
          const variableResponse = row.original.variables[link.storageKey];
          if (typeof variableResponse === "string" || typeof variableResponse === "number") {
            return <div className="text-slate-900">{variableResponse}</div>;
          }
        },
      };
    }
  );

  // ENG-3233: two ingested fields may share a name, and a truncated header makes that worse — the
  // later one carries its storage key so the columns stay tellable apart.
  const hiddenFieldColumns: ColumnDef<TResponseTableData>[] = labelEmbeddedFields(
    getIngestedEmbeddedFields(survey)
  ).map(({ link, label }) => {
    return {
      accessorKey: "HIDDEN_FIELD_" + link.storageKey,
      meta: { label },
      header: () => (
        <div className="flex items-center gap-x-2 overflow-hidden">
          <span className="size-4">
            <EyeOffIcon className="size-4" />
          </span>
          <span className="truncate">{label}</span>
        </div>
      ),
      cell: ({ row }) => {
        const hiddenFieldResponse = displayEmbeddedValue(row.original.responseData[link.storageKey]);
        if (hiddenFieldResponse !== null) {
          return <div className="text-slate-900">{hiddenFieldResponse}</div>;
        }
      },
    };
  });

  const metadataColumns = getMetadataColumnsData(t);

  const verifiedEmailColumn: ColumnDef<TResponseTableData> = {
    accessorKey: "verifiedEmail",
    meta: { label: t("common.verified_email") },
    header: () => (
      <div className="flex items-center gap-x-2 overflow-hidden">
        <span className="size-4">
          <MailIcon className="size-4" />
        </span>
        <span className="truncate">{t("common.verified_email")}</span>
      </div>
    ),
  };

  // Combine the selection column with the dynamic element columns
  const baseColumns = [
    personColumn,
    singleUseIdColumn,
    responseIdColumn,
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

  const columns = baseColumns.map(withEmptyDash);
  return isReadOnly ? columns : [getSelectionColumn(), ...columns];
};
