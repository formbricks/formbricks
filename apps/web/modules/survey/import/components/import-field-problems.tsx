"use client";

import { useTranslation } from "react-i18next";
import type { TV3InvalidParam } from "@/modules/api/lib/v3-client";
import { getSurveyImportFieldProblemHeadline } from "@/modules/survey/import/lib/import-errors";

/** At most this many problems are listed; the rest are counted in one more line. */
const MAX_LISTED_PROBLEMS = 10;

type ImportFieldProblemsProps = {
  problems: readonly Pick<TV3InvalidParam, "name" | "reason" | "code">[];
  testId?: string;
};

/**
 * The fields the server refused, from a file the import could not read or a Match the Update would
 * refuse. Each says what is wrong in the user's language, with the field's path; under it, the
 * server's reason as it was given, the technical detail a user pastes back to an AI assistant to fix
 * the file.
 *
 * Paths and reasons come from the user's file: rendered as text only.
 */
export const ImportFieldProblems = ({ problems, testId }: Readonly<ImportFieldProblemsProps>) => {
  const { t } = useTranslation();
  if (problems.length === 0) return null;

  const shown = problems.slice(0, MAX_LISTED_PROBLEMS);
  const unlisted = problems.length - shown.length;

  return (
    <ul className="mt-1 list-disc space-y-1 pl-4" data-testid={testId}>
      {shown.map((problem, index) => (
        <li key={`${problem.name}-${index}`} className="break-words">
          {getSurveyImportFieldProblemHeadline(problem.code, t)}:{" "}
          <code className="text-xs">{problem.name}</code>
          <span className="block text-xs">{problem.reason}</span>
        </li>
      ))}
      {unlisted > 0 ? (
        <li>{t("workspace.surveys.import.errors.more_problems", { count: unlisted })}</li>
      ) : null}
    </ul>
  );
};
