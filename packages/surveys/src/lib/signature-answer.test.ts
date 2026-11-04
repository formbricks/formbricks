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

  test("only the active tab is uploaded: Draw uploads the drawing, not the name kept behind the other tab", async () => {
    const { exportPng, uploadPng } = setup();
    const both: SignatureValue = { ...drawn, typedName: "Ada" };
    const first = await resolveSignatureAnswer({
      draft: draftOf({ ...both, mode: "draw" }),
      savedUrl: "",
      exportPng,
      uploadPng,
    });
    expect(first).toMatchObject({ status: "ok", url: STORED_URL });
    expect(exportPng).toHaveBeenLastCalledWith({ ...both, mode: "draw" });
  });

  test("switching tabs changes which content is up to date: the same inputs upload again for the other tab", async () => {
    const { exportPng, uploadPng } = setup();
    const both: SignatureValue = { ...drawn, typedName: "Ada" };
    const drawnUpload = await resolveSignatureAnswer({
      draft: draftOf({ ...both, mode: "draw" }),
      savedUrl: "",
      exportPng,
      uploadPng,
    });
    if (drawnUpload.status !== "ok") throw new Error("expected ok");

    await resolveSignatureAnswer({
      draft: draftOf({ ...both, mode: "type" }, drawnUpload.uploaded),
      savedUrl: drawnUpload.url,
      exportPng,
      uploadPng,
    });
    expect(uploadPng).toHaveBeenCalledTimes(2);
  });

  test("going back to the tab that was uploaded reuses that upload: the inactive tab's edits do not matter", async () => {
    const { exportPng, uploadPng } = setup();
    const first = await resolveSignatureAnswer({ draft: draftOf(drawn), savedUrl: "", exportPng, uploadPng });
    if (first.status !== "ok") throw new Error("expected ok");

    const result = await resolveSignatureAnswer({
      draft: draftOf({ ...drawn, typedName: "typed later, behind the Draw tab" }, first.uploaded),
      savedUrl: first.url,
      exportPng,
      uploadPng,
    });
    expect(uploadPng).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "ok", url: STORED_URL });
  });

  test("Type with an empty name is not signed even though a drawing is kept: nothing is exported, no URL answers", async () => {
    const { exportPng, uploadPng } = setup();
    const result = await resolveSignatureAnswer({
      draft: draftOf({ ...drawn, mode: "type", typedName: "" }),
      savedUrl: "",
      exportPng,
      uploadPng,
    });
    expect(result).toEqual({ status: "ok", url: "", uploaded: null });
    expect(exportPng).not.toHaveBeenCalled();
    expect(uploadPng).not.toHaveBeenCalled();
  });

  test("Type with an empty name after an earlier upload does not answer with the stored drawing", async () => {
    const { exportPng, uploadPng } = setup();
    const uploaded = { fingerprint: "strokes:x", url: STORED_URL };
    const result = await resolveSignatureAnswer({
      draft: draftOf({ ...drawn, mode: "type", typedName: "" }, uploaded),
      savedUrl: STORED_URL,
      exportPng,
      uploadPng,
    });
    expect(result).toMatchObject({ status: "ok", url: "" });
    expect(uploadPng).not.toHaveBeenCalled();
  });

  test("an empty tab after an upload forgets the cached upload, so switching back uploads again (the server deleted the first image)", async () => {
    const { exportPng, uploadPng } = setup({
      uploadPng: vi
        .fn<() => Promise<string>>()
        .mockResolvedValueOnce(STORED_URL)
        .mockResolvedValueOnce(OTHER_URL),
    });
    const typedAnn: SignatureValue = { ...EMPTY_SIGNATURE, mode: "type", typedName: "Ann" };

    // Type "Ann" -> Next: uploaded.
    const first = await resolveSignatureAnswer({
      draft: draftOf(typedAnn),
      savedUrl: "",
      exportPng,
      uploadPng,
    });
    expect(first).toMatchObject({ status: "ok", url: STORED_URL });
    if (first.status !== "ok") throw new Error("unreachable");

    // Back -> Draw (nothing drawn) -> Next: replaces the stored URL with "", the server queues the first image for deletion.
    const emptied = await resolveSignatureAnswer({
      draft: draftOf({ ...typedAnn, mode: "draw" }, first.uploaded),
      savedUrl: STORED_URL,
      exportPng,
      uploadPng,
    });
    expect(emptied).toMatchObject({ status: "ok", url: "", uploaded: null });
    if (emptied.status !== "ok") throw new Error("unreachable");

    // Back -> Type again -> Next: the first image is gone, so "Ann" must be uploaded again, not answered with its URL.
    const again = await resolveSignatureAnswer({
      draft: draftOf(typedAnn, emptied.uploaded),
      savedUrl: "",
      exportPng,
      uploadPng,
    });
    expect(again).toMatchObject({ status: "ok", url: OTHER_URL });
    expect(uploadPng).toHaveBeenCalledTimes(2);
  });

  test("Draw with no drawing is not signed even though a typed name is kept", async () => {
    const { exportPng, uploadPng } = setup();
    const result = await resolveSignatureAnswer({
      draft: draftOf({ mode: "draw", strokes: [], typedName: "Ada" }),
      savedUrl: "",
      exportPng,
      uploadPng,
    });
    expect(result).toEqual({ status: "ok", url: "", uploaded: null });
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

describe("the visible tab decides whether the element is answered", () => {
  test("Type with an empty name after drawing is not an answer, so a required Signature shows the required error", () => {
    expect(hasSignatureAnswer(draftOf({ ...drawn, mode: "type", typedName: "" }), "")).toBe(false);
    expect(hasSignatureAnswer(draftOf({ ...drawn, mode: "type", typedName: "   " }), "")).toBe(false);
  });

  test("Draw with no drawing after typing a name is not an answer", () => {
    expect(hasSignatureAnswer(draftOf({ mode: "draw", strokes: [], typedName: "Ada" }), "")).toBe(false);
  });

  test("switching back to the tab that holds the signature makes it an answer again", () => {
    const both: SignatureValue = { ...drawn, typedName: "Ada" };
    expect(hasSignatureAnswer(draftOf({ ...both, mode: "type" }), "")).toBe(true);
    expect(hasSignatureAnswer(draftOf({ ...both, mode: "draw" }), "")).toBe(true);
  });

  test("a stored URL does not make an empty tab an answer once the pad holds input", () => {
    expect(hasSignatureAnswer(draftOf({ ...drawn, mode: "type", typedName: "" }), STORED_URL)).toBe(false);
  });

  test("after a reload (nothing kept in memory) the stored URL is the answer", () => {
    expect(hasSignatureAnswer(draftOf({ ...EMPTY_SIGNATURE, mode: "type" }), STORED_URL)).toBe(true);
  });

  test("an optional Signature switched to an empty tab after an upload replaces the stored answer with an empty one", () => {
    expect(toSignatureAnswerData("sig1", "", { savedUrl: STORED_URL, overwriteStored: false })).toEqual({
      sig1: "",
    });
    expect(toSignatureAnswerData("sig1", "", { savedUrl: "", overwriteStored: false })).toEqual({});
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

  test("a network failure, which is what an upload attempt rejects with offline, shows the upload-failed error", async () => {
    const offline = new TypeError("Failed to fetch");
    const uploadPng = vi.fn<() => Promise<string>>().mockRejectedValue(offline);
    const { exportPng } = setup();

    const result = await resolveSignatureAnswer({
      draft: draftOf(drawn),
      savedUrl: "",
      exportPng,
      uploadPng,
    });

    expect(result).toEqual({ status: "error", error: offline });
    expect(getSignatureUploadError(offline)).toEqual({
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
    expect(
      toSignatureAnswerData("sig1", "", {
        savedUrl: cleared.savedUrl,
        overwriteStored: cleared.overwriteStored,
      })
    ).toEqual({ sig1: "" });
  });

  test("clearing a signature that was never stored does not invent an answer", () => {
    const cleared = clearSignatureAnswerState({
      draft: draftOf(drawn),
      savedUrl: "",
      overwriteStored: false,
    });
    expect(cleared.overwriteStored).toBe(false);
    expect(
      toSignatureAnswerData("sig1", "", {
        savedUrl: cleared.savedUrl,
        overwriteStored: cleared.overwriteStored,
      })
    ).toEqual({});
  });

  test("a URL is always the answer", () => {
    expect(toSignatureAnswerData("sig1", STORED_URL, { savedUrl: "", overwriteStored: true })).toEqual({
      sig1: STORED_URL,
    });
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
