import type { TSurveyImportStreamEvent } from "@/app/api/internal/surveys/import/lib/events";
import type { TImportProgressStage, TImportReportSource } from "../types";

/**
 * The dialog's view of a running import, fed by stream events only — never by timers. Pure so the
 * mapping is testable without React.
 */
export type TImportProgressState = {
  source: TImportReportSource | null;
  stage: TImportProgressStage | null;
  chunk: { index: number; total: number } | null;
  /** Language codes seen in partial drafts so far (default first, in order of appearance). */
  languageCodes: string[];
  finished: boolean;
};

export const INITIAL_IMPORT_PROGRESS: TImportProgressState = {
  source: null,
  stage: null,
  chunk: null,
  languageCodes: [],
  finished: false,
};

export const IMPORT_PROGRESS_STAGES: readonly TImportProgressStage[] = [
  "reading",
  "detecting_languages",
  "extracting",
  "validating",
];

function collectLanguageCodes(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (entry && typeof entry === "object" && "languageCode" in entry) {
        const code = (entry as { languageCode?: unknown }).languageCode;
        if (typeof code === "string" && code.length > 0) into.add(code);
      } else {
        collectLanguageCodes(entry, into);
      }
    }
  } else if (value && typeof value === "object") {
    for (const nested of Object.values(value)) collectLanguageCodes(nested, into);
  }
}

export function reduceImportProgress(
  state: TImportProgressState,
  event: TSurveyImportStreamEvent | { type: string }
): TImportProgressState {
  switch (event.type) {
    case "start": {
      const start = event as Extract<TSurveyImportStreamEvent, { type: "start" }>;
      return { ...INITIAL_IMPORT_PROGRESS, source: start.source };
    }
    case "progress": {
      const progress = event as Extract<TSurveyImportStreamEvent, { type: "progress" }>;
      return { ...state, stage: progress.stage, chunk: progress.chunk ?? null };
    }
    case "partial": {
      const partial = event as Extract<TSurveyImportStreamEvent, { type: "partial" }>;
      const codes = new Set(state.languageCodes);
      collectLanguageCodes(partial.draft, codes);
      return codes.size === state.languageCodes.length ? state : { ...state, languageCodes: [...codes] };
    }
    case "done": {
      const done = event as Extract<TSurveyImportStreamEvent, { type: "done" }>;
      const fromReport = done.report.source.detectedLanguages?.map((language) => language.code) ?? [];
      const codes = new Set([...state.languageCodes, ...fromReport, ...done.report.summary.languages]);
      return {
        ...state,
        source: done.report.source,
        stage: "validating",
        chunk: null,
        finished: true,
        languageCodes: [...codes],
      };
    }
    default:
      return state;
  }
}

export type TImportProgressStepStatus = "done" | "current" | "pending";

export type TImportProgressStep = {
  stage: TImportProgressStage;
  status: TImportProgressStepStatus;
  chunk: { index: number; total: number } | null;
  languageCodes: string[];
};

/**
 * Four steps, each done / current / pending from the last stage the server reported. Deterministic
 * lanes skip detection and extraction, so those steps are marked done the moment validation starts.
 */
export function getImportProgressSteps(state: TImportProgressState): TImportProgressStep[] {
  const currentIndex = state.stage === null ? -1 : IMPORT_PROGRESS_STAGES.indexOf(state.stage);
  return IMPORT_PROGRESS_STAGES.map((stage, index) => {
    let status: TImportProgressStepStatus = "pending";
    if (state.finished || index < currentIndex) status = "done";
    else if (index === currentIndex) status = "current";
    return {
      stage,
      status,
      chunk: stage === "extracting" ? state.chunk : null,
      languageCodes: stage === "detecting_languages" ? state.languageCodes : [],
    };
  });
}

/** `EN · DE` — the short badge form the review rows use. */
export function formatLanguageCodes(codes: readonly string[]): string {
  return codes.map((code) => code.split("-")[0].toUpperCase()).join(" · ");
}
