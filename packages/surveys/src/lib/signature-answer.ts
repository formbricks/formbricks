import {
  EMPTY_SIGNATURE,
  type SignatureValue,
  clearSignature,
  isSignatureSigned,
  signatureFingerprint,
} from "@formbricks/survey-ui";
import { FILE_UPLOAD_ERROR_NAMES } from "@formbricks/types/errors";
import { type TResponseData } from "@formbricks/types/responses";

/**
 * What the Signature element keeps in survey state for one element, so the respondent's drawing
 * survives leaving the card (Back, or the card scrolling out of the rendered window) until they Clear.
 * `uploaded` remembers the image the last successful upload stored, and which strokes/name it was made from.
 */
export interface SignatureDraft {
  value: SignatureValue;
  uploaded: { fingerprint: string; url: string } | null;
}

/** One draft per Signature element id, owned by the `Survey` for as long as it is mounted. */
export type SignatureDraftStore = Map<string, SignatureDraft>;

export const createSignatureDraftStore = (): SignatureDraftStore => new Map();

/**
 * Forgets every drawing and typed name. The survey calls it when it finishes and when it unmounts, so a
 * signature does not outlive the response it belonged to in the page's memory.
 */
export const clearSignatureDrafts = (store: SignatureDraftStore): void => {
  store.clear();
};

export const EMPTY_SIGNATURE_DRAFT: SignatureDraft = { value: EMPTY_SIGNATURE, uploaded: null };

/**
 * Everything the element knows about its answer, read synchronously. The survey's own copy of the stored
 * URL lags a render behind a Clear, so Next must be decided from this and not from props.
 */
export interface SignatureAnswerState {
  draft: SignatureDraft;
  /** The URL already in the survey's answers: set after an earlier Next, or restored after a reload. */
  savedUrl: string;
  /** A stored URL was cleared, so an empty answer has to be sent explicitly to replace it on the server. */
  overwriteStored: boolean;
}

/** The state after Clear: nothing drawn, typed or saved, and the stale URL can never be submitted again. */
export const clearSignatureAnswerState = (state: SignatureAnswerState): SignatureAnswerState => ({
  draft: { value: clearSignature(state.draft.value), uploaded: null },
  savedUrl: "",
  overwriteStored: state.overwriteStored || state.savedUrl !== "" || state.draft.uploaded !== null,
});

/**
 * The answer data a Signature contributes on Next. A URL is the answer; with none, the element sends
 * nothing, unless a stored URL was cleared, in which case `""` replaces it.
 */
export const toSignatureAnswerData = (
  elementId: string,
  url: string,
  overwriteStored: boolean
): TResponseData => {
  if (url) return { [elementId]: url };
  return overwriteStored ? { [elementId]: "" } : {};
};

export type SignatureAnswerResult =
  | {
      status: "ok";
      /** The stored URL, or `""` when there is nothing to store (an optional Signature left empty). */
      url: string;
      /** The draft to remember: the upload this call made, or the one it reused. */
      uploaded: SignatureDraft["uploaded"];
    }
  | { status: "error"; error: unknown };

interface ResolveSignatureAnswerParams {
  draft: SignatureDraft;
  /** The URL already in the survey's answers: set after an earlier Next, or restored after a reload. */
  savedUrl: string;
  /** Renders the signature to a PNG data URL; `null` when it is not signed. */
  exportPng: (value: SignatureValue) => Promise<string | null>;
  /** Uploads a PNG data URL and returns its stored URL. */
  uploadPng: (dataUrl: string) => Promise<string>;
  /** How long to wait for the upload before reporting it as failed. */
  uploadTimeoutMs?: number;
}

/** A stalled upload must not lock the card for good: past this it fails like any other upload error. */
export const SIGNATURE_UPLOAD_TIMEOUT_MS = 30_000;

const withUploadTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        Object.assign(new Error("Signature upload timed out"), {
          name: FILE_UPLOAD_ERROR_NAMES.STORAGE_UPLOAD_FAILED,
        })
      );
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });

/**
 * Whether the element holds an answer at all, before anything is uploaded. Required-validation asks
 * this on Next: a signature that is drawn but not uploaded yet is an answer, and a Clear is not.
 */
export const hasSignatureAnswer = (draft: SignatureDraft, savedUrl: string): boolean =>
  isSignatureSigned(draft.value) || savedUrl !== "";

/**
 * Produces the element's answer when the block is submitted ("upload on Next"). The PNG is made and
 * uploaded once; pressing Next again, or returning to the card and pressing Next without changing the
 * signature, reuses the stored URL instead of uploading a second copy.
 *
 * - nothing drawn or typed and a saved URL (the page was reloaded): the saved URL stays the answer;
 * - nothing drawn or typed and no saved URL: no answer (`""`);
 * - signed, and the last upload was of the same strokes/name: that upload's URL;
 * - otherwise: export, upload, and report the new URL.
 *
 * Never throws. A failed or timed-out export or upload, or an upload that returns no URL, comes back as `status: "error"`, which the caller shows and
 * does not advance on; the next call simply tries again.
 */
export const resolveSignatureAnswer = async ({
  draft,
  savedUrl,
  exportPng,
  uploadPng,
  uploadTimeoutMs = SIGNATURE_UPLOAD_TIMEOUT_MS,
}: ResolveSignatureAnswerParams): Promise<SignatureAnswerResult> => {
  const fingerprint = signatureFingerprint(draft.value);

  if (fingerprint === null) {
    return { status: "ok", url: savedUrl, uploaded: draft.uploaded };
  }

  if (draft.uploaded?.fingerprint === fingerprint) {
    return { status: "ok", url: draft.uploaded.url, uploaded: draft.uploaded };
  }

  try {
    const dataUrl = await exportPng(draft.value);
    if (!dataUrl) return { status: "ok", url: savedUrl, uploaded: draft.uploaded };
    const url = await withUploadTimeout(uploadPng(dataUrl), uploadTimeoutMs);
    // A response without a URL stores nothing; treating it as success would submit an empty answer.
    if (typeof url !== "string" || url === "") throw new Error("Upload returned no URL");
    return { status: "ok", url, uploaded: { fingerprint, url } };
  } catch (error) {
    return { status: "error", error };
  }
};

/**
 * The translation key for an upload failure, or the server's own message for a too-large file.
 * Same mapping File upload shows, so a respondent sees the same wording for the same failure.
 */
export const getSignatureUploadError = (
  error: unknown
): { kind: "message"; message: string } | { kind: "key"; key: string } => {
  const named = error as { name?: string; message?: string } | null | undefined;
  switch (named?.name) {
    case FILE_UPLOAD_ERROR_NAMES.FILE_TOO_LARGE:
      return { kind: "message", message: named.message ?? "" };
    case FILE_UPLOAD_ERROR_NAMES.INVALID_FILE_NAME:
      return { kind: "key", key: "errors.file_input.invalid_file_name" };
    case FILE_UPLOAD_ERROR_NAMES.STORAGE_NOT_CONFIGURED:
    case FILE_UPLOAD_ERROR_NAMES.STORAGE_UPLOAD_FAILED:
      return { kind: "key", key: "errors.file_input.upload_service_unavailable" };
    default:
      return { kind: "key", key: "errors.file_input.upload_failed" };
  }
};
