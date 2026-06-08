type TEnvValidationIssuePathSegment = PropertyKey | { readonly key: PropertyKey };

export type TEnvValidationIssue = {
  readonly message: string;
  readonly path?: ReadonlyArray<TEnvValidationIssuePathSegment>;
};

type TEnvValidationIssueLogEntry = {
  readonly path: string;
  readonly message: string;
};

const formatPathSegment = (segment: TEnvValidationIssuePathSegment): string => {
  if (typeof segment === "object" && segment !== null && "key" in segment) {
    return String(segment.key);
  }

  return String(segment);
};

const getEnvValidationIssuePath = (issue: TEnvValidationIssue): string =>
  issue.path?.length ? issue.path.map(formatPathSegment).join(".") : "unknown";

const sanitizeEnvValidationIssuesForLogging = (
  issues: readonly TEnvValidationIssue[]
): TEnvValidationIssueLogEntry[] =>
  issues.map((issue) => ({
    path: getEnvValidationIssuePath(issue),
    message: issue.message,
  }));

export const formatEnvValidationIssue = (issue: TEnvValidationIssue): string => {
  return `${getEnvValidationIssuePath(issue)}: ${issue.message}`;
};

export const formatEnvValidationErrorMessage = (issues: readonly TEnvValidationIssue[]): string => {
  const formattedIssues = issues.map((issue) => `  - ${formatEnvValidationIssue(issue)}`).join("\n");

  return `Invalid environment variables:\n${formattedIssues}`;
};

export const throwEnvValidationError = (issues: readonly TEnvValidationIssue[]): never => {
  const message = formatEnvValidationErrorMessage(issues);

  console.error(message, { issues: sanitizeEnvValidationIssuesForLogging(issues) });
  throw new Error(message);
};
