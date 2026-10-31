/**
 * Client-safe helpers for a survey's upload elements: File upload and Signature.
 *
 * Split out of `./utils` — which is `server-only` because it reaches for `WEBAPP_URL` and the public
 * domain — so a client component can ask "does this survey collect files?" without dragging server
 * config into the bundle. Same arrangement as `./url-helpers`, and `./utils` re-exports from here so
 * existing server-side imports keep working.
 */
import type { TAllowedFileExtension } from "@formbricks/types/storage";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import {
  TSurveyElementTypeEnum,
  TSurveyFileUploadElement,
  TSurveySignatureElement,
} from "@formbricks/types/surveys/elements";

/**
 * The minimum an element must expose to be recognised as an upload element (File upload or Signature).
 *
 * Structural rather than `TSurveyQuestion[]`: that type is deprecated (v1 back-compat only), and this
 * shape accepts both it and `TSurveyElement[]` without importing the deprecated union.
 */
export type TUploadElementCandidate = { id: string; type: string };

/** An element whose answer holds storage URLs. */
export type TSurveyUploadElement = TSurveyFileUploadElement | TSurveySignatureElement;

/** The element types whose answer holds storage URLs. */
export type TUploadElementType = TSurveyUploadElement["type"];

/** The upload element of one type. */
type TUploadElementOfType<T extends TUploadElementType> = Extract<TSurveyUploadElement, { type: T }>;

/**
 * How one upload element type stores and accepts its answer. The element's type decides which shape is
 * accepted, never the value's.
 *
 * A discriminated union so a bare-string kind must name its extensions: a future string-shaped type
 * cannot fail open to "any extension" by leaving them out. An array kind takes its extensions from the
 * element's own config, so it reads them rather than fixing any. Each kind therefore owns where its
 * type's allowed-extension list comes from, and no caller switches on the element type to find out.
 */
export type TUploadElementKind<TElement extends TSurveyUploadElement = TSurveyUploadElement> =
  | TArrayUploadElementKind<TElement>
  | TStringUploadElementKind;

/** An answer that is an array of URLs (File upload). */
export type TArrayUploadElementKind<TElement extends TSurveyUploadElement = TSurveyUploadElement> = {
  answerShape: "array";
  fixedAllowedExtensions?: never;
  emptyStringIsSkipped: boolean;
  /**
   * The extensions the element's own config restricts it to, or `undefined` for no restriction. Method
   * syntax on purpose: it keeps the parameter bivariant, so a reader written for one element type fits
   * the kind map's wider `TUploadElementKind`. The lookup is by the element's type, so it only ever
   * receives its own.
   */
  readAllowedExtensions(element: TElement): readonly TAllowedFileExtension[] | undefined;
};

/**
 * An answer that is one URL string (Signature, see ADR 0016). The extensions are fixed by the element
 * type: the runtime always exports a Signature as a PNG, so anything else under one is not a signature.
 */
export type TStringUploadElementKind = {
  answerShape: "string";
  fixedAllowedExtensions: readonly [TAllowedFileExtension, ...TAllowedFileExtension[]];
  /** Whether `""` is a skipped answer rather than a URL (a skipped Signature may be stored as `""`). */
  emptyStringIsSkipped: boolean;
};

/**
 * Where the upload element types differ. Every place that would otherwise ask "File upload or
 * Signature?" reads this instead, so a new upload element type is one more entry here.
 */
export const uploadElementKinds = {
  [TSurveyElementTypeEnum.FileUpload]: {
    answerShape: "array",
    emptyStringIsSkipped: false,
    readAllowedExtensions: (element) => element.allowedFileExtensions,
  },
  [TSurveyElementTypeEnum.Signature]: {
    answerShape: "string",
    fixedAllowedExtensions: ["png"],
    emptyStringIsSkipped: true,
  },
} as const satisfies { [T in TUploadElementType]: TUploadElementKind<TUploadElementOfType<T>> };

/** The kind of an upload element type, or `undefined` for any other element type. */
export const getUploadElementKind = (type: string): TUploadElementKind | undefined =>
  Object.hasOwn(uploadElementKinds, type) ? uploadElementKinds[type as TUploadElementType] : undefined;

/** The extensions an upload element accepts: its type's fixed set, else its own config's. */
export const getUploadElementAllowedExtensions = (
  element: TSurveyUploadElement
): readonly TAllowedFileExtension[] | undefined => {
  const kind: TUploadElementKind = uploadElementKinds[element.type];

  return kind.answerShape === "string" ? kind.fixedAllowedExtensions : kind.readAllowedExtensions(element);
};

/** A value for every upload element type, derived from `uploadElementKinds`' keys. */
export const mapUploadElementTypes = <T>(
  build: (type: TUploadElementType) => T
): Record<TUploadElementType, T> =>
  Object.fromEntries(
    (Object.keys(uploadElementKinds) as TUploadElementType[]).map((type) => [type, build(type)])
  ) as Record<TUploadElementType, T>;

/**
 * The ids of the elements whose answers hold storage URLs, split by how the answer holds them: a File
 * upload answer is an array of URLs, a Signature answer is one URL string (ADR 0016).
 *
 * The split is what lets `collectResponseFileUrls` accept a string for a Signature id only. A single
 * flat set would force it to guess the shape from the value, and a plain text answer holding a pasted
 * storage URL would become a delete target. `live` is every element id the survey still has, of any
 * type: a string under an id outside it is what a deleted or retyped Signature leaves behind.
 */
export type TSurveyUploadElementIds = Record<TUploadElementType, ReadonlySet<string>> & {
  live: ReadonlySet<string>;
};

/**
 * The ids of a survey whose elements were not read: every upload type gets an empty set, derived from
 * `uploadElementKinds` so a new upload element type needs no edit here.
 */
export const createEmptyUploadElementIds = (): TSurveyUploadElementIds => ({
  ...mapUploadElementTypes(() => new Set<string>()),
  live: new Set<string>(),
});

/**
 * Every upload element in a survey: File upload and Signature.
 *
 * A survey holds its elements in `blocks` or in legacy `questions`, so both shapes are read: keying off
 * one alone silently misses the other. Callers that must tell the two apart read `uploadElementKinds`.
 */
export const getSurveyUploadElementConfigs = ({
  blocks,
  questions,
}: {
  blocks?: TSurveyBlock[] | null;
  questions?: readonly TUploadElementCandidate[] | null;
}): TSurveyUploadElement[] => {
  const isUploadElement = (element: { type: string }) => getUploadElementKind(element.type) !== undefined;

  return [
    ...(blocks ?? []).flatMap((block) => block.elements).filter(isUploadElement),
    // The element and legacy question enums spell both types the same (`"fileUpload"`, `"signature"`),
    // so the element enum covers the legacy shape too.
    ...(questions ?? []).filter(isUploadElement),
  ] as TSurveyUploadElement[];
};
