/**
 * The Export modal's request and what it means (ENG-6792). Pure: the modal builds a request, the route
 * validates it and asks `planExport` which export it is, and both read the same advanced-option
 * definitions. No server-only imports, so client components can use it.
 */
import type { TFunction } from "i18next";
import { z } from "zod";
import { ZResponseFilterCriteria } from "@formbricks/types/responses";
import type { TAnswerDisplay } from "./types";

export type TExportFormat = "csv" | "xlsx";

/** Responses a "selected rows" export may name. The ids travel in the POST body (about 30 bytes each). */
export const EXPORT_MAX_SELECTED_RESPONSES = 25_000;

/**
 * One entry of the modal's Advanced options. Adding an option is adding an entry: the modal renders the
 * list, the route validates against it, and `planExport` reads `forcesZip`.
 */
export type TExportAdvancedOption = {
  id: "datamap" | "unmappedValues";
  label: (t: TFunction) => string;
  description: (t: TFunction) => string;
  /** The formats the option is offered for. */
  appliesTo: readonly TExportFormat[];
  /** On a CSV export, turning this on adds a file, so the download becomes a zip. */
  forcesZip: boolean;
};

export const EXPORT_ADVANCED_OPTIONS: readonly TExportAdvancedOption[] = [
  {
    id: "datamap",
    label: (t) => t("workspace.surveys.export.advanced_datamap_label"),
    description: (t) => t("workspace.surveys.export.advanced_datamap_description"),
    appliesTo: ["csv", "xlsx"],
    forcesZip: true,
  },
  {
    id: "unmappedValues",
    label: (t) => t("workspace.surveys.export.advanced_unmapped_label"),
    description: (t) => t("workspace.surveys.export.advanced_unmapped_description"),
    appliesTo: ["csv", "xlsx"],
    forcesZip: true,
  },
];

export type TExportAdvancedOptionId = TExportAdvancedOption["id"];

const ADVANCED_IDS = EXPORT_ADVANCED_OPTIONS.map((option) => option.id) as [
  TExportAdvancedOptionId,
  ...TExportAdvancedOptionId[],
];

/**
 * The filter crosses the wire as JSON, where `createdAt`'s Dates are ISO text. Turn them back into Dates
 * before the shared filter schema, which (like the server actions this replaces) expects `Date`.
 */
const reviveFilterDates = (filter: unknown): unknown => {
  if (typeof filter !== "object" || filter === null || !("createdAt" in filter)) return filter;
  const { createdAt } = filter as { createdAt: unknown };
  if (typeof createdAt !== "object" || createdAt === null) return filter;
  const revive = (value: unknown) => (typeof value === "string" ? new Date(value) : value);
  const { min, max } = createdAt as { min?: unknown; max?: unknown };
  return {
    ...filter,
    createdAt: {
      ...(min === undefined ? {} : { min: revive(min) }),
      ...(max === undefined ? {} : { max: revive(max) }),
    },
  };
};

export const ZExportRequest = z
  .object({
    format: z.enum(["csv", "xlsx"]),
    /** Text only is today's Standard export; Code only and Text and code are Analysis exports. */
    display: z.enum(["text", "codes", "both"]).default("text"),
    /**
     * Display questions: what the column headers say. Text only is today's Standard export. Left out, the
     * headers follow `display` (the first version of this route), which only a hand-written request does.
     */
    questions: z.enum(["text", "codes", "both"]).optional(),
    /** The SPSS syntax file. CSV only, and it needs codes. */
    spss: z.boolean().default(false),
    /** Compress into .zip: a single CSV file downloads as a zip too. Always a zip when the export has several files. */
    zip: z.boolean().default(false),
    /** Ids of the Advanced options that are on. */
    advanced: z.array(z.enum(ADVANCED_IDS)).max(ADVANCED_IDS.length).default([]),
    /**
     * Ids of the column groups the Include columns list switched off (see `column-selection.ts`). The
     * Standard defaults leave none off, which is today's file with every column.
     */
    excludedColumns: z.array(z.string().min(1).max(300)).max(2000).default([]),
    /** The Responses filter, or `{ responseIds }` for a selection of rows. */
    filter: z.preprocess(reviveFilterDates, ZResponseFilterCriteria.optional()),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (request.spss && request.format !== "csv") {
      ctx.addIssue({ code: "custom", path: ["spss"], message: "The SPSS syntax file is for CSV exports." });
    }
    if (request.zip && request.format !== "csv") {
      ctx.addIssue({ code: "custom", path: ["zip"], message: "Compressing into a zip is for CSV exports." });
    }
    if (request.spss && request.questions === "text") {
      ctx.addIssue({ code: "custom", path: ["spss"], message: "The SPSS syntax file needs question codes." });
    }
    if (request.spss && request.display === "text") {
      ctx.addIssue({ code: "custom", path: ["spss"], message: "The SPSS syntax file needs answer codes." });
    }
    for (const id of request.advanced) {
      const definition = EXPORT_ADVANCED_OPTIONS.find((option) => option.id === id);
      if (definition && !definition.appliesTo.includes(request.format)) {
        ctx.addIssue({
          code: "custom",
          path: ["advanced"],
          message: `"${id}" does not apply to ${request.format}.`,
        });
      }
    }
    if ((request.filter?.responseIds?.length ?? 0) > EXPORT_MAX_SELECTED_RESPONSES) {
      ctx.addIssue({
        code: "custom",
        path: ["filter", "responseIds"],
        message: `At most ${EXPORT_MAX_SELECTED_RESPONSES} responses can be selected.`,
      });
    }
  });

export type TExportRequest = z.infer<typeof ZExportRequest>;

export type TExportOutput = "csv" | "zip" | "xlsx";

export type TExportPlan =
  /** Today's file: the existing Standard export path, byte for byte. */
  | { kind: "standard"; format: TExportFormat; zip?: true }
  | {
      kind: "analysis";
      format: TExportFormat;
      display: TAnswerDisplay;
      /** Display questions, or `undefined` when the headers follow `display`. */
      questions?: TAnswerDisplay;
      output: TExportOutput;
      include: { datamap: boolean; unmappedValues: boolean; spssSyntax: boolean };
    };

/**
 * Which export a request asks for (GLOSSARY: Standard export, Analysis export). Anything but the
 * defaults, that is codes, an advanced option or the SPSS file, is an Analysis export.
 */
export const planExport = (
  request: Pick<TExportRequest, "format" | "display" | "spss" | "advanced"> &
    Partial<Pick<TExportRequest, "questions" | "zip">>
): TExportPlan => {
  const { format, display, questions, spss, advanced } = request;
  const zip = request.zip === true && format === "csv";
  const questionsAsToday = questions === undefined || questions === "text";
  if (display === "text" && questionsAsToday && !spss && advanced.length === 0) {
    return { kind: "standard", format, ...(zip ? { zip } : {}) };
  }

  const include = {
    datamap: advanced.includes("datamap"),
    unmappedValues: advanced.includes("unmappedValues"),
    spssSyntax: spss,
  };
  if (format === "xlsx") return { kind: "analysis", format, display, questions, output: "xlsx", include };

  const addsFile =
    zip ||
    display === "both" ||
    spss ||
    advanced.some((id) => EXPORT_ADVANCED_OPTIONS.find((option) => option.id === id)?.forcesZip);
  return { kind: "analysis", format, display, questions, output: addsFile ? "zip" : "csv", include };
};

/** The file extension and media type of what a plan downloads. */
export const exportFileType = (plan: TExportPlan): { extension: "csv" | "xlsx" | "zip"; mime: string } => {
  const output = plan.kind === "standard" ? (plan.zip ? "zip" : plan.format) : plan.output;
  if (output === "xlsx") {
    return { extension: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }
  if (output === "zip") return { extension: "zip", mime: "application/zip" };
  return { extension: "csv", mime: "text/csv;charset=utf-8" };
};
