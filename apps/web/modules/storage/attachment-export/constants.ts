/**
 * Every limit of the attachment export (ENG-1256, ENG-6862), in one place so a reviewer can see them
 * together.
 */

/** Above this the export is refused outright: narrowing the filter is the intended remedy. */
export const MAX_ATTACHMENT_FILES = 5000;

/**
 * The archive stops before crossing this, and says so in `_TRUNCATED.txt`. Enforced while the archive is
 * written rather than pre-flighted: object sizes are not in the database, so checking first would mean
 * thousands of S3 HEAD requests.
 */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * How long a finished archive stays downloadable, in calendar months from when it was built. The email
 * that delivers it states the date, and the reconcile job deletes the archive once it passes.
 */
export const ATTACHMENT_EXPORT_RETENTION_MONTHS = 3;

/** When an archive built at `finishedAt` expires: the same day of the month, three months later. */
export const getAttachmentExportExpiry = (finishedAt: Date): Date => {
  const expiresAt = new Date(finishedAt);
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + ATTACHMENT_EXPORT_RETENTION_MONTHS);
  return expiresAt;
};

/**
 * Lifetime of the presigned download URL. A browser resumes an interrupted download against the same
 * URL, so it has to outlive a slow multi-GB transfer; a fresh one is minted every time the emailed link
 * is opened, so a short lifetime never locks anyone out. Credentials from an assumed role can cap it lower.
 */
export const ATTACHMENT_EXPORT_DOWNLOAD_URL_TTL_SECONDS = 6 * 60 * 60;

/** Wall time one build may take before it is aborted and the export fails. */
export const ATTACHMENT_EXPORT_MAX_BUILD_MS = 60 * 60 * 1000;

/** A queued export with no build started after this is re-dispatched by the reconcile job. */
export const ATTACHMENT_EXPORT_REDISPATCH_AFTER_MS = 5 * 60 * 1000;

/**
 * A queued or running export created longer ago than this has been lost (a killed pod, an older release
 * dropping the job) and is failed by the reconcile job. Longer than two full builds, the job's attempts,
 * plus the retry backoff, so a slow second attempt is never failed under itself.
 */
export const ATTACHMENT_EXPORT_STALE_AFTER_MS = 3 * 60 * 60 * 1000;

/** Rows the reconcile job handles per pass and step, so one pass stays short. */
export const ATTACHMENT_EXPORT_RECONCILE_BATCH = 50;
