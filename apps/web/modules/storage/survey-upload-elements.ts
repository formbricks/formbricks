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
  /** No per-kind size cap: the general upload limits apply as they do for any file. */
  maxFileSizeBytes?: never;
};

/**
 * An answer that is one URL string (Signature, see ADR 0023). The extensions are fixed by the element
 * type: the runtime always exports a Signature as a PNG, so anything else under one is not a signature.
 */
export type TStringUploadElementKind = {
  answerShape: "string";
  fixedAllowedExtensions: readonly [TAllowedFileExtension, ...TAllowedFileExtension[]];
  /** Whether `""` is a skipped answer rather than a URL (a skipped Signature may be stored as `""`). */
  emptyStringIsSkipped: boolean;
  /**
   * The only file name an upload for this kind may carry, checked when the upload URL is issued so a client
   * cannot store a file that a later write would refuse. It is the name the runtime sends.
   */
  uploadFileName: string;
  /**
   * The name the stored file must have: the one the upload route produces for the name the runtime
   * sends (`getSignedUrlForUpload` renames `name.ext` to `name--fid--{uuid}.ext`). A write whose URL
   * names anything else was not produced by an upload for this element.
   */
  fileNamePattern: RegExp;
  /** The most one file of this kind may weigh. Applied beside the general limit: the lower wins. */
  maxFileSizeBytes: number;
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
    // `signature.png` as the runtime names its export (`SIGNATURE_PNG_FILE_NAME`), then the id the upload adds.
    uploadFileName: "signature.png",
    fileNamePattern: /^signature--fid--[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    // A 900x300 export is about 35 KB; 1 MB leaves headroom without letting a public upload route hold
    // the general limit (up to 1 GB on enterprise) for a file the owner views as a thumbnail.
    maxFileSizeBytes: 1024 * 1024,
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

/**
 * The size ceiling an upload element's kind sets, or `undefined` when the kind sets none (File upload).
 * The route applies it beside the general limit, so it can only ever lower it.
 */
export const getUploadElementMaxFileSize = (element: TSurveyUploadElement): number | undefined => {
  const kind: TUploadElementKind = uploadElementKinds[element.type];

  return kind.maxFileSizeBytes;
};

/** The size ceiling the kind of the survey's upload element `elementId` sets, if any. */
export const getSurveyUploadElementMaxFileSize = ({
  elementId,
  blocks,
  questions,
}: {
  elementId: string;
  blocks?: TSurveyBlock[] | null;
  questions?: readonly TUploadElementCandidate[] | null;
}): number | undefined => {
  const element = getSurveyUploadElementConfigs({ blocks, questions }).find(
    (config) => config.id === elementId
  );

  return element ? getUploadElementMaxFileSize(element) : undefined;
};

/** A value for every upload element type, derived from `uploadElementKinds`' keys. */
export const mapUploadElementTypes = <T>(
  build: (type: TUploadElementType) => T
): Record<TUploadElementType, T> =>
  Object.fromEntries(
    (Object.keys(uploadElementKinds) as TUploadElementType[]).map((type) => [type, build(type)])
  ) as Record<TUploadElementType, T>;

/**
 * The ids of the upload elements a survey has, per element type.
 *
 * `collectResponseFileUrls` reads the File upload set to trust a flat pre-#8044 key inside that
 * element's array. It does not read the Signature set: a bare string is a delete target by its key's
 * scope under any element id, never by which element holds it (ADR 0023).
 */
export type TSurveyUploadElementIds = Record<TUploadElementType, ReadonlySet<string>>;

/**
 * The ids of a survey whose elements were not read: every upload type gets an empty set, derived from
 * `uploadElementKinds` so a new upload element type needs no edit here.
 */
export const createEmptyUploadElementIds = (): TSurveyUploadElementIds =>
  mapUploadElementTypes(() => new Set<string>());

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
