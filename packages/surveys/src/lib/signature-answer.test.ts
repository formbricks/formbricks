import { afterEach, describe, expect, test, vi } from "vitest";
import { EMPTY_SIGNATURE, type SignatureValue } from "@formbricks/survey-ui";
import { FILE_UPLOAD_ERROR_NAMES } from "@formbricks/types/errors";
import {
  EMPTY_SIGNATURE_DRAFT,
  SIGNATURE_UPLOAD_TIMEOUT_MS,
  type SignatureAnswerState,
  type SignatureDraft,
  clearSignatureAnswerState,
  clearSignatureDrafts,
  createSignatureDraftStore,
  getSignatureUploadError,
  hasSignatureAnswer,
  resolveSignatureAnswer,
  toSignatureAnswerData,
} from "./signature-answer";

const STORED_URL = "/storage/ws1/private/surveys/survey1/elements/sig1/signature--fid--abc.png";
const OTHER_URL = "/storage/ws1/private/surveys/survey1/elements/sig1/signature--fid--def.png";

const drawn: SignatureValue = {
  ...EMPTY_SIGNATURE,
  strokes: [
    [
      { x: 0.1, y: 0.5 },
      { x: 0.8, y: 0.5 },
    ],
  ],
};
const draftOf = (value: SignatureValue, uploaded: SignatureDraft["uploaded"] = null): SignatureDraft => ({
  value,
  uploaded,
});

const setup = (
  overrides: Partial<{ exportPng: () => Promise<string | null>; uploadPng: () => Promise<string> }> = {}
) => {
  const exportPng = vi.fn(overrides.exportPng ?? (() => Promise.resolve("data:image/png;base64,AAAA")));
  const uploadPng = vi.fn(overrides.uploadPng ?? (() => Promise.resolve(STORED_URL)));
  return { exportPng, uploadPng };
};

describe("resolveSignatureAnswer (upload on Next)", () => {
  test("exports the signature, uploads it once and answers with the stored URL", async () => {
    const { exportPng, uploadPng } = setup();
    const result = await resolveSignatureAnswer({
      draft: draftOf(drawn),
      savedUrl: "",
      exportPng,
      uploadPng,
    });

    expect(exportPng).toHaveBeenCalledTimes(1);
    expect(uploadPng).toHaveBeenCalledWith("data:image/png;base64,AAAA");
    expect(result).toEqual({
      status: "ok",
      url: STORED_URL,
      uploaded: { fingerprint: expect.any(String), url: STORED_URL },
    });
  });

  test("pressing Next again with an unchanged signature does not upload a second copy", async () => {
    const { exportPng, uploadPng } = setup();
    const first = await resolveSignatureAnswer({ draft: draftOf(drawn), savedUrl: "", exportPng, uploadPng });
    if (first.status !== "ok") throw new Error("expected ok");

    const second = await resolveSignatureAnswer({
      draft: draftOf(drawn, first.uploaded),
      savedUrl: STORED_URL,
      exportPng,
      uploadPng,
    });

    expect(uploadPng).toHaveBeenCalledTimes(1);
    expect(exportPng).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ status: "ok", url: STORED_URL });
  });

  test("a changed signature is uploaded again and the new URL wins", async () => {
    const { exportPng, uploadPng } = setup({ uploadPng: () => Promise.resolve(OTHER_URL) });
    const redrawn: SignatureValue = {
      ...drawn,
      strokes: [...drawn.strokes, drawn.strokes[0].slice().reverse()],
    };

    const result = await resolveSignatureAnswer({
      draft: draftOf(redrawn, { fingerprint: "strokes:old", url: STORED_URL }),
      savedUrl: STORED_URL,
      exportPng,
      uploadPng,
    });

    expect(uploadPng).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "ok", url: OTHER_URL });
  });

  test("a typed name switched back to the same text reuses the earlier upload", async () => {
    const { exportPng, uploadPng } = setup();
    const typed: SignatureValue = { mode: "type", strokes: [], typedName: "Ada" };
    const first = await resolveSignatureAnswer({ draft: draftOf(typed), savedUrl: "", exportPng, uploadPng });
    if (first.status !== "ok") throw new Error("expected ok");

    await resolveSignatureAnswer({
      draft: draftOf({ ...typed, typedName: "  Ada " }, first.uploaded),
      savedUrl: first.url,
      exportPng,
      uploadPng,
    });
    expect(uploadPng).toHaveBeenCalledTimes(1);
  });

  test("an unsigned optional Signature answers with nothing and uploads nothing", async () => {
    const { exportPng, uploadPng } = setup();
    const result = await resolveSignatureAnswer({
      draft: EMPTY_SIGNATURE_DRAFT,
      savedUrl: "",
      exportPng,
      uploadPng,
    });
    expect(result).toEqual({ status: "ok", url: "", uploaded: null });
    expect(exportPng).not.toHaveBeenCalled();
    expect(uploadPng).not.toHaveBeenCalled();
  });

  test("a bare tap is not a signature: nothing is exported or uploaded", async () => {
    const { exportPng, uploadPng } = setup();
    const tap: SignatureValue = { ...EMPTY_SIGNATURE, strokes: [[{ x: 0.5, y: 0.5 }]] };
    const result = await resolveSignatureAnswer({ draft: draftOf(tap), savedUrl: "", exportPng, uploadPng });
    expect(result).toMatchObject({ status: "ok", url: "" });
    expect(uploadPng).not.toHaveBeenCalled();
  });

  test("after a reload only the URL exists: it stays the answer and nothing is uploaded", async () => {
    const { exportPng, uploadPng } = setup();
    const result = await resolveSignatureAnswer({
      draft: EMPTY_SIGNATURE_DRAFT,
      savedUrl: STORED_URL,
      exportPng,
      uploadPng,
    });
    expect(result).toMatchObject({ status: "ok", url: STORED_URL });
    expect(uploadPng).not.toHaveBeenCalled();
  });

  test("an upload failure is reported, not thrown, and the next press tries again", async () => {
    const failure = Object.assign(new Error("down"), { name: FILE_UPLOAD_ERROR_NAMES.STORAGE_UPLOAD_FAILED });
    const uploadPng = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(STORED_URL);
    const { exportPng } = setup();

    const failed = await resolveSignatureAnswer({
      draft: draftOf(drawn),
      savedUrl: "",
      exportPng,
      uploadPng,
    });
    expect(failed).toEqual({ status: "error", error: failure });

    const retried = await resolveSignatureAnswer({
      draft: draftOf(drawn),
      savedUrl: "",
      exportPng,
      uploadPng,
    });
    expect(retried).toMatchObject({ status: "ok", url: STORED_URL });
    expect(uploadPng).toHaveBeenCalledTimes(2);
  });

  test("a failed export is reported as an error and nothing is uploaded", async () => {
    const { uploadPng } = setup();
    const exportPng = vi.fn(() => Promise.reject(new Error("Canvas 2D context is unavailable")));
    const result = await resolveSignatureAnswer({
      draft: draftOf(drawn),
      savedUrl: "",
      exportPng,
      uploadPng,
    });
    expect(result.status).toBe("error");
    expect(uploadPng).not.toHaveBeenCalled();
  });
});

describe("hasSignatureAnswer", () => {
  test("a drawn signature is an answer before it is uploaded", () => {
    expect(hasSignatureAnswer(draftOf(drawn), "")).toBe(true);
  });

  test("a saved URL is an answer even with nothing drawn", () => {
    expect(hasSignatureAnswer(EMPTY_SIGNATURE_DRAFT, STORED_URL)).toBe(true);
  });

  test("nothing drawn, typed or saved is no answer", () => {
    expect(hasSignatureAnswer(EMPTY_SIGNATURE_DRAFT, "")).toBe(false);
    expect(hasSignatureAnswer(draftOf({ ...EMPTY_SIGNATURE, typedName: "   " }), "")).toBe(false);
  });
});

describe("getSignatureUploadError", () => {
  test("uses the same wording File upload shows for the same failure", () => {
    const named = (name: string) => Object.assign(new Error("x"), { name });
    expect(getSignatureUploadError(named(FILE_UPLOAD_ERROR_NAMES.STORAGE_NOT_CONFIGURED))).toEqual({
      kind: "key",
      key: "errors.file_input.upload_service_unavailable",
    });
    expect(getSignatureUploadError(named(FILE_UPLOAD_ERROR_NAMES.STORAGE_UPLOAD_FAILED))).toEqual({
      kind: "key",
      key: "errors.file_input.upload_service_unavailable",
    });
    expect(getSignatureUploadError(named(FILE_UPLOAD_ERROR_NAMES.INVALID_FILE_NAME))).toEqual({
      kind: "key",
      key: "errors.file_input.invalid_file_name",
    });
    expect(getSignatureUploadError(new Error("boom"))).toEqual({
      kind: "key",
      key: "errors.file_input.upload_failed",
    });
    expect(getSignatureUploadError(undefined)).toEqual({
      kind: "key",
      key: "errors.file_input.upload_failed",
    });
  });

  test("a too-large file shows the server's own message", () => {
    const error = Object.assign(new Error("File size exceeds the size limit"), {
      name: FILE_UPLOAD_ERROR_NAMES.FILE_TOO_LARGE,
    });
    expect(getSignatureUploadError(error)).toEqual({
      kind: "message",
      message: "File size exceeds the size limit",
    });
  });
});

describe("upload timeout and empty responses", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("a stalled upload fails with the upload-unavailable error instead of locking the card", async () => {
    vi.useFakeTimers();
    const { exportPng } = setup();
    const uploadPng = vi.fn(() => new Promise<string>(() => undefined));
    const pending = resolveSignatureAnswer({ draft: draftOf(drawn), savedUrl: "", exportPng, uploadPng });

    await vi.advanceTimersByTimeAsync(SIGNATURE_UPLOAD_TIMEOUT_MS - 1);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(getSignatureUploadError(result.error)).toEqual({
        kind: "key",
        key: "errors.file_input.upload_service_unavailable",
      });
    }
  });

  test("an upload that finishes in time cancels the timer", async () => {
    vi.useFakeTimers();
    const { exportPng, uploadPng } = setup();
    const result = await resolveSignatureAnswer({
      draft: draftOf(drawn),
      savedUrl: "",
      exportPng,
      uploadPng,
    });
    expect(result.status).toBe("ok");
    expect(vi.getTimerCount()).toBe(0);
  });

  test("an upload that resolves with an empty URL is an error, never an empty answer", async () => {
    const { exportPng } = setup();
    for (const empty of ["", undefined as unknown as string]) {
      const result = await resolveSignatureAnswer({
        draft: draftOf(drawn),
        savedUrl: "",
        exportPng,
        uploadPng: () => Promise.resolve(empty),
      });
      expect(result.status).toBe("error");
    }
  });
});

describe("Clear and the stored URL", () => {
  const stateWithSavedUpload = (): SignatureAnswerState => ({
    draft: draftOf(drawn, { fingerprint: "strokes:x", url: STORED_URL }),
    savedUrl: STORED_URL,
    overwriteStored: false,
  });

  test("Clear leaves nothing that could be submitted: no strokes, no cached upload, no saved URL", () => {
    const cleared = clearSignatureAnswerState(stateWithSavedUpload());
    expect(cleared.draft).toEqual({ value: { mode: "draw", strokes: [], typedName: "" }, uploaded: null });
    expect(cleared.savedUrl).toBe("");
    expect(hasSignatureAnswer(cleared.draft, cleared.savedUrl)).toBe(false);
  });

  test("a fast Clear then Next never submits the stale URL and does not pass required validation", async () => {
    const cleared = clearSignatureAnswerState(stateWithSavedUpload());
    const { exportPng, uploadPng } = setup();
    const result = await resolveSignatureAnswer({ ...cleared, exportPng, uploadPng });

    expect(hasSignatureAnswer(cleared.draft, cleared.savedUrl)).toBe(false);
    expect(result).toMatchObject({ status: "ok", url: "" });
    expect(uploadPng).not.toHaveBeenCalled();
  });

  test("after Clear the stale stored answer is replaced with an empty one on the server", () => {
    const cleared = clearSignatureAnswerState(stateWithSavedUpload());
    expect(cleared.overwriteStored).toBe(true);
    expect(toSignatureAnswerData("sig1", "", cleared.overwriteStored)).toEqual({ sig1: "" });
  });

  test("clearing a signature that was never stored does not invent an answer", () => {
    const cleared = clearSignatureAnswerState({
      draft: draftOf(drawn),
      savedUrl: "",
      overwriteStored: false,
    });
    expect(cleared.overwriteStored).toBe(false);
    expect(toSignatureAnswerData("sig1", "", cleared.overwriteStored)).toEqual({});
  });

  test("a URL is always the answer", () => {
    expect(toSignatureAnswerData("sig1", STORED_URL, true)).toEqual({ sig1: STORED_URL });
  });
});

describe("clearSignatureDrafts", () => {
  test("forgets every drawing and typed name", () => {
    const store = createSignatureDraftStore();
    store.set("sig1", draftOf(drawn));
    store.set("sig2", draftOf({ ...EMPTY_SIGNATURE, mode: "type", typedName: "Ada" }));
    clearSignatureDrafts(store);
    expect(store.size).toBe(0);
  });
});
