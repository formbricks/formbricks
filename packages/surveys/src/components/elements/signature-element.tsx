import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import {
  SIGNATURE_PNG_FILE_NAME,
  SIGNATURE_PNG_MIME_TYPE,
  Signature,
  type SignatureLabels,
  type SignatureValue,
  exportSignaturePng,
  loadSignatureFont,
} from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveySignatureElement } from "@formbricks/types/surveys/elements";
import { type SubmitContributor } from "@/lib/block-submit";
import { getLocalizedValue } from "@/lib/i18n";
import {
  EMPTY_SIGNATURE_DRAFT,
  type SignatureAnswerState,
  type SignatureDraft,
  type SignatureDraftStore,
  clearSignatureAnswerState,
  getSignatureUploadError,
  hasSignatureAnswer,
  resolveSignatureAnswer,
  toSignatureAnswerData,
} from "@/lib/signature-answer";
import { getSignatureFontUrl } from "@/lib/signature-font-url";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface SignatureElementProps {
  element: TSurveySignatureElement;
  /** The stored URL of the signature: set after an earlier Next, or restored after a reload. */
  value: string;
  onChange: (responseData: TResponseData) => void;
  onFileUpload: (file: any, config?: any) => Promise<string>;
  surveyId: string;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentElementId: string;
  errorMessage?: string;
  dir?: "ltr" | "rtl" | "auto";
  /** The survey's in-memory drafts: what keeps a drawing when the card is left and returned to. */
  signatureDrafts: SignatureDraftStore;
  /** Lets the block ask this element for its answer when Next is pressed. */
  registerSubmitContributor: (elementId: string, contributor: SubmitContributor | null) => void;
}

export function SignatureElement({
  element,
  value,
  onChange,
  onFileUpload,
  surveyId,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  errorMessage: centralizedErrorMessage,
  dir,
  signatureDrafts,
  registerSubmitContributor,
}: Readonly<SignatureElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const isCurrent = element.id === currentElementId;
  const { t } = useTranslation();

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const [draft, setDraftState] = useState<SignatureDraft>(
    () => signatureDrafts.get(element.id) ?? EMPTY_SIGNATURE_DRAFT
  );
  const [savedUrl, setSavedUrlState] = useState(value);

  // Everything the element knows about its answer, kept in a ref so the upload on Next and the block's
  // validation read it as it is now, not as of the render they started in. The survey's own copy of the
  // stored URL (`value`) lags a render behind a Clear, so it is never consulted for that decision.
  const answerRef = useRef<SignatureAnswerState>({ draft, savedUrl: value, overwriteStored: false });
  const fontUrl = getSignatureFontUrl();
  const callbacksRef = useRef({ onFileUpload, surveyId, fontUrl, t });
  useEffect(() => {
    callbacksRef.current = { onFileUpload, surveyId, fontUrl, t };
  });

  const commit = useCallback(
    (next: SignatureAnswerState) => {
      answerRef.current = next;
      signatureDrafts.set(element.id, next.draft);
      setDraftState(next.draft);
      setSavedUrlState(next.savedUrl);
    },
    [signatureDrafts, element.id]
  );

  // The survey sets the stored URL after Next and restores it after a reload.
  useEffect(() => {
    answerRef.current = { ...answerRef.current, savedUrl: value };
    setSavedUrlState(value);
  }, [value]);

  // Centralised (required) errors come from the block; upload errors are this element's own.
  const errorMessage = centralizedErrorMessage || uploadErrorMessage;

  const handleChange = (next: SignatureValue) => {
    setUploadErrorMessage(undefined);
    commit({ ...answerRef.current, draft: { ...answerRef.current.draft, value: next } });
    // Re-reports the stored answer (none yet is ""), which is how the block learns the respondent acted
    // and drops a required error left from an earlier Next. The image itself is made on the next Next.
    onChange({ [element.id]: answerRef.current.savedUrl });
  };

  const handleClear = () => {
    setUploadErrorMessage(undefined);
    // Synchronous: a Next pressed straight after Clear must not see the old URL.
    commit(clearSignatureAnswerState(answerRef.current));
    // Drops a signature saved earlier from the survey's answers too.
    onChange({ [element.id]: "" });
  };

  useEffect(() => {
    const contributor: SubmitContributor = {
      hasAnswer: () => hasSignatureAnswer(answerRef.current.draft, answerRef.current.savedUrl),
      resolveAnswer: async () => {
        setUploadErrorMessage(undefined);
        const {
          onFileUpload: upload,
          surveyId: currentSurveyId,
          fontUrl: currentFontUrl,
          t: translate,
        } = callbacksRef.current;

        try {
          const result = await resolveSignatureAnswer({
            draft: answerRef.current.draft,
            savedUrl: answerRef.current.savedUrl,
            // The busy state starts only when there is real work: a signature already uploaded, or one
            // left empty, answers straight away.
            exportPng: (signature) => {
              setIsUploading(true);
              return exportSignaturePng(signature, {
                ensureTypedFont: () =>
                  currentFontUrl ? loadSignatureFont(currentFontUrl) : Promise.resolve(false),
              });
            },
            uploadPng: (dataUrl) =>
              upload(
                { name: SIGNATURE_PNG_FILE_NAME, type: SIGNATURE_PNG_MIME_TYPE, base64: dataUrl },
                { allowedFileExtensions: ["png"], surveyId: currentSurveyId, elementId: element.id }
              ),
          });

          if (result.status === "error") {
            const failure = getSignatureUploadError(result.error);
            setUploadErrorMessage(failure.kind === "message" ? failure.message : translate(failure.key));
            return { ok: false };
          }

          const current = answerRef.current;
          commit({ ...current, draft: { ...current.draft, uploaded: result.uploaded } });
          return { ok: true, data: toSignatureAnswerData(element.id, result.url, current.overwriteStored) };
        } finally {
          setIsUploading(false);
        }
      },
    };
    registerSubmitContributor(element.id, contributor);
    return () => {
      registerSubmitContributor(element.id, null);
    };
  }, [element.id, registerSubmitContributor, commit]);

  const labels = useMemo<Partial<SignatureLabels>>(
    () => ({
      clear: t("signature.clear"),
      draw: t("signature.draw"),
      type: t("signature.type"),
      typeYourName: t("signature.type_your_name"),
      method: t("signature.method"),
      padLabel: t(element.allowTypedSignature ? "signature.pad_label_with_type" : "signature.pad_label"),
      signHere: t("signature.sign_here"),
      signed: t("signature.signed"),
      notSigned: t("signature.not_signed"),
      saved: t("signature.saved"),
      uploading: t("errors.file_input.uploading"),
    }),
    [t, element.allowTypedSignature]
  );

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    // Validation is handled by centralized system, just update TTC
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  return (
    <form key={element.id} onSubmit={handleSubmit} className="w-full">
      <Signature
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        value={draft.value}
        onChange={handleChange}
        onClear={handleClear}
        allowTypedSignature={element.allowTypedSignature}
        hasSavedSignature={savedUrl !== ""}
        isUploading={isUploading}
        typedFontUrl={fontUrl}
        labels={labels}
        required={element.required}
        requiredLabel={t("common.required")}
        errorMessage={errorMessage}
        dir={dir}
        imageUrl={element.imageUrl}
        imageAltText={getLocalizedValue(element.imageAltText, languageCode)}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
