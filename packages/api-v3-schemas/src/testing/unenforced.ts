/**
 * Contract constraints the generated schemas do not enforce, pinned one by one.
 *
 * hey-api cannot express these in Zod: `uniqueItems`, `minProperties`/`maxProperties` and `if/then/else`
 * never reach its intermediate representation, a required key with no type becomes `z.unknown()`,
 * which accepts the key being absent, and a contract-specific `format` it does not know (every one but
 * `cuid2`, which the renderer teaches it) generates a plain string. Each one is therefore owned by a
 * consumer's refinement layer, and the two sides of that ownership are both held by tests:
 *
 * - `src/generated.contract.test.ts` fails when generated-vs-spec differs by anything not listed
 *   here — so adopting a tag, or a spec edit, cannot add an unenforced constraint unnoticed — and when a
 *   listed entry stops differing (the generator learned it; drop the pin and the refinement).
 * - The consumer's coverage test (Responses: `apps/web/app/api/v3/responses/lib/write-schemas.test.ts`,
 *   Creatives: `apps/web/app/api/v3/creatives/lib/schemas.test.ts`) must reject a counterexample for
 *   every entry in its scope, at the right path.
 */
export type TUnenforcedKeyword =
  | "uniqueItems"
  | "minProperties"
  | "maxProperties"
  | "conditional"
  | "requiredAtRuntime"
  | "format";

export type TUnenforced = {
  /** The component the constraint is published on, as it appears under `components.schemas`. */
  schema: string;
  /** Fact path inside that component (`$` is the component, `.name` a property, `{}` a map value). */
  path: string;
  keyword: TUnenforcedKeyword;
  /**
   * What the contract states there, exactly as the fidelity diff reports it: the bound, `true`, the
   * conditional's fingerprint, or the loosely-required keys. Pinning the value — not only the keyword —
   * means a spec edit that changes the bound fails the pin, and so reaches the consumer that hard-codes it.
   */
  specValue: string | number | boolean;
  /** The module whose refinements enforce it; its coverage test selects its pins by this path. */
  enforcedBy: string;
};

export const unenforcedKey = ({ schema, path, keyword }: TUnenforced): string =>
  `${schema} ${path} ${keyword}`;

const RESPONSES = "apps/web/app/api/v3/responses/lib/schemas.ts";
const CREATIVES = "apps/web/app/api/v3/creatives/lib/schemas.ts";

/** The fingerprint `facts.ts` gives `ResponseDataMapInput`'s per-value `if/then/else` caps. */
const DATA_VALUE_CAPS = "sha256:cd2aad86b9e1d557";

const pin = (
  schema: string,
  path: string,
  keyword: TUnenforcedKeyword,
  specValue: string | number | boolean,
  enforcedBy: string = RESPONSES
): TUnenforced => ({ schema, path, keyword, specValue, enforcedBy });

/** A link Destination's `url`: a real host, which the published pattern can only approximate. */
const webUrl = (schema: string, path: string): TUnenforced =>
  pin(schema, path, "format", "web-url", CREATIVES);

export const EXPECTED_UNENFORCED: readonly TUnenforced[] = [
  pin("BatchDeleteResponsesRequest", "$.ids", "uniqueItems", true),
  pin("CreateResponseRequest", "$.data", "maxProperties", 500),
  pin("CreateResponseRequest", "$.data{}", "conditional", DATA_VALUE_CAPS),
  pin("CreateResponseRequest", "$.embeddedData", "maxProperties", 500),
  pin("CreateResponseRequest", "$.tags", "uniqueItems", true),
  pin("CreateResponseRequest", "$.ttc", "maxProperties", 500),
  pin("PatchResponseRequest", "$", "minProperties", 1),
  pin("PatchResponseRequest", "$.data", "maxProperties", 500),
  pin("PatchResponseRequest", "$.data{}", "conditional", DATA_VALUE_CAPS),
  pin("PatchResponseRequest", "$.embeddedData", "maxProperties", 500),
  pin("ResponseDataMapInput", "$", "maxProperties", 500),
  pin("ResponseDataMapInput", "${}", "conditional", DATA_VALUE_CAPS),
  pin("ResponseEmbeddedDataInput", "$", "maxProperties", 500),
  pin("ResponseTtcMap", "$", "maxProperties", 500),
  // `data` is required but untyped; generated as `z.unknown()`, which Zod satisfies with no key at all.
  pin("ValidateResponseCreateRequest", "$", "requiredAtRuntime", "data"),
  pin("ValidateResponsePatchRequest", "$", "requiredAtRuntime", "data"),
  pin("ValidateResponseRequest", "$|operation=create", "requiredAtRuntime", "data"),
  pin("ValidateResponseRequest", "$|operation=patch", "requiredAtRuntime", "data"),
  webUrl("CreateBannerCreativeRequest", "$.destination|type=link.url"),
  webUrl("CreateCreativeRequest", "$|type=banner.destination|type=link.url"),
  webUrl("CreateCreativeRequest", "$|type=feedbackButton.destination|type=link.url"),
  webUrl("CreateCreativeRequestBase", "$.destination|type=link.url"),
  webUrl("CreateFeedbackButtonCreativeRequest", "$.destination|type=link.url"),
  webUrl("CreativeDestinationInput", "$|type=link.url"),
  webUrl("CreativeLinkDestinationInput", "$.url"),
  webUrl("PatchCreativeRequest", "$.destination|type=link.url"),
];
