import { DETAIL_VALUE_MAX_CHARS, answerToLines, isRecord, truncate } from "./cells";
import { readFailure } from "./parse";
import type { Parsed, RawToolResult } from "./types";

export interface DetailAnswer {
  id: string;
  label: string;
  type: string;
  /** Display lines, each capped; an answer with no value has none. */
  lines: string[];
}

export interface DetailModel {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  finished: boolean;
  language: string | null;
  durationSeconds: number | null;
  contact: { id: string; userId: string | null } | null;
  tags: string[];
  answers: DetailAnswer[];
  embedded: { label: string; value: string }[];
}

const MAX_EMBEDDED = 50;

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/** The `get_response` result as the detail panel renders it. Everything is text; nothing is HTML. */
export const parseDetail = (result: RawToolResult | null | undefined): Parsed<DetailModel> => {
  const failure = readFailure(result);
  if (failure) return { ok: false, message: failure };

  const structured = result?.structuredContent;
  const data = isRecord(structured) ? structured.data : undefined;
  if (!isRecord(data))
    return { ok: false, message: "The response came back in a shape this view cannot read." };

  const id = asString(data.id);
  const createdAt = asString(data.createdAt);
  if (!id || !createdAt || typeof data.finished !== "boolean") {
    return { ok: false, message: "The response came back in a shape this view cannot read." };
  }

  const answers = (Array.isArray(data.answers) ? data.answers : []).filter(isRecord).flatMap((answer) => {
    const answerId = asString(answer.elementId);
    if (!answerId) return [];
    return [
      {
        id: answerId,
        label: asString(answer.elementLabel) ?? answerId,
        type: asString(answer.elementType) ?? "unknown",
        lines: answerToLines(answer).map((line) => truncate(line, DETAIL_VALUE_MAX_CHARS)),
      },
    ];
  });

  const embedded = (Array.isArray(data.embeddedData) ? data.embeddedData : [])
    .filter(isRecord)
    .slice(0, MAX_EMBEDDED)
    .flatMap((datum) => {
      const label = asString(datum.label) ?? asString(datum.key);
      const value = datum.value;
      if (!label || (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")) {
        return [];
      }
      return [{ label, value: truncate(String(value), DETAIL_VALUE_MAX_CHARS) }];
    });

  const contact =
    isRecord(data.contact) && asString(data.contact.id)
      ? { id: asString(data.contact.id) as string, userId: asString(data.contact.userId) ?? null }
      : null;

  return {
    ok: true,
    value: {
      id,
      createdAt,
      updatedAt: asString(data.updatedAt) ?? null,
      finished: data.finished,
      language: asString(data.language) ?? null,
      durationSeconds: typeof data.durationSeconds === "number" ? data.durationSeconds : null,
      contact,
      tags: (Array.isArray(data.tags) ? data.tags : [])
        .filter(isRecord)
        .map((tag) => asString(tag.name))
        .filter((name): name is string => name !== undefined && name !== ""),
      answers,
      embedded,
    },
  };
};
