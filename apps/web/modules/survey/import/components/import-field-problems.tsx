"use client";

import { useTranslation } from "react-i18next";
import type { InvalidParam } from "@/app/api/v3/lib/response";

/** At most this many problems are listed; the rest are counted in one more line. */
const MAX_LISTED_PROBLEMS = 10;

type ImportFieldProblemsProps = {
  problems: readonly Pick<InvalidParam, "name" | "reason">[];
  testId?: string;
};

/**
 * The fields the server refused, from a file the import could not read or a Match the Update would
 * refuse: each field's path and the server's reason.
 *
 * Paths and reasons come from the user's file: rendered as text only.
 */
export const ImportFieldProblems = ({ problems, testId }: Readonly<ImportFieldProblemsProps>) => {
  const { t } = useTranslation();
  if (problems.length === 0) return null;

  const shown = problems.slice(0, MAX_LISTED_PROBLEMS);
  const unlisted = problems.length - shown.length;

  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-4" data-testid={testId}>
      {shown.map((problem, index) => (
        <li key={`${problem.name}-${index}`} className="break-words">
          <code className="text-xs">{problem.name}</code>: {problem.reason}
        </li>
      ))}
      {unlisted > 0 ? (
        <li>{t("workspace.surveys.import.errors.more_problems", { count: unlisted })}</li>
      ) : null}
    </ul>
  );
};
