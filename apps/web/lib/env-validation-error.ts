type TEnvValidationIssuePathSegment = PropertyKey | { readonly key: PropertyKey };

export type TEnvValidationIssue = {
  readonly message: string;
  readonly path?: ReadonlyArray<TEnvValidationIssuePathSegment>;
};

const formatPathSegment = (segment: TEnvValidationIssuePathSegment): string => {
  if (typeof segment === "object" && segment !== null && "key" in segment) {
    return String(segment.key);
  }

  return String(segment);
};

export const formatEnvValidationIssue = (issue: TEnvValidationIssue): string => {
  const field = issue.path?.length ? issue.path.map(formatPathSegment).join(".") : "unknown";

  return `${field}: ${issue.message}`;
};

export const formatEnvValidationErrorMessage = (issues: readonly TEnvValidationIssue[]): string => {
  const formattedIssues = issues.map((issue) => `  - ${formatEnvValidationIssue(issue)}`).join("\n");

  return `Invalid environment variables:\n${formattedIssues}`;
};

export const throwEnvValidationError = (issues: readonly TEnvValidationIssue[]): never => {
  const message = formatEnvValidationErrorMessage(issues);

  console.error(message, { issues });
  throw new Error(message);
};
