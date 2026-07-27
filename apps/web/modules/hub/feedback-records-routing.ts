export const FEEDBACK_RECORDS_V3_PREFIX = "/api/v3/feedbackRecords";
export const FEEDBACK_RECORDS_SDK_PREFIX = "/v1/feedback-records";

const stripFeedbackRecordsPrefix = (pathname: string, prefix: string): string | null => {
  if (pathname === prefix) {
    return "/";
  }

  if (!pathname.startsWith(`${prefix}/`)) {
    return null;
  }

  return pathname.slice(prefix.length) || "/";
};

export const normalizeFeedbackRecordsPath = (pathname: string): string | null => {
  const v3Path = stripFeedbackRecordsPrefix(pathname, FEEDBACK_RECORDS_V3_PREFIX);
  if (v3Path) {
    return v3Path;
  }

  const sdkPath = stripFeedbackRecordsPrefix(pathname, FEEDBACK_RECORDS_SDK_PREFIX);
  if (sdkPath) {
    return sdkPath;
  }

  return null;
};

export const getFeedbackRecordsHubPathname = (pathname: string): string | null => {
  if (stripFeedbackRecordsPrefix(pathname, FEEDBACK_RECORDS_V3_PREFIX) !== null) {
    return `${FEEDBACK_RECORDS_SDK_PREFIX}${pathname.slice(FEEDBACK_RECORDS_V3_PREFIX.length)}`;
  }

  return stripFeedbackRecordsPrefix(pathname, FEEDBACK_RECORDS_SDK_PREFIX) !== null ? pathname : null;
};
