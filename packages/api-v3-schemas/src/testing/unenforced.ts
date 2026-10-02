/**
 * Contract constraints the generated schemas do not enforce, pinned one by one.
 *
 * hey-api cannot express these keywords in Zod: `uniqueItems`, `minProperties`/`maxProperties` and
 * `if/then/else` never reach its intermediate representation. Each one is therefore owned by a
 * consumer's refinement layer, and the two sides of that ownership are both held by tests:
 *
 * - `src/generated.contract.test.ts` fails when generated-vs-spec differs by anything not listed
 *   here — so adopting a tag, or a spec edit, cannot add an unenforced constraint unnoticed — and when a
 *   listed entry stops differing (the generator learned it; drop the pin and the refinement).
 * - The consumer's coverage test (Responses: `apps/web/app/api/v3/responses/lib/write-schemas.test.ts`)
 *   must reject a counterexample for every entry in its scope, at the right path.
 */
export type TUnenforcedKeyword = "uniqueItems" | "minProperties" | "maxProperties" | "conditional";

export type TUnenforced = {
  /** The component the constraint is published on, as it appears under `components.schemas`. */
  schema: string;
  /** Fact path inside that component (`$` is the component, `.name` a property, `{}` a map value). */
  path: string;
  keyword: TUnenforcedKeyword;
  /** The module whose refinements enforce it; its coverage test selects its pins by this path. */
  enforcedBy: string;
};

export const unenforcedKey = ({ schema, path, keyword }: TUnenforced): string =>
  `${schema} ${path} ${keyword}`;

const RESPONSES = "apps/web/app/api/v3/responses/lib/schemas.ts";

export const EXPECTED_UNENFORCED: readonly TUnenforced[] = [
  { schema: "BatchDeleteResponsesRequest", path: "$.ids", keyword: "uniqueItems", enforcedBy: RESPONSES },
  { schema: "CreateResponseRequest", path: "$.data", keyword: "maxProperties", enforcedBy: RESPONSES },
  { schema: "CreateResponseRequest", path: "$.data{}", keyword: "conditional", enforcedBy: RESPONSES },
  {
    schema: "CreateResponseRequest",
    path: "$.embeddedData",
    keyword: "maxProperties",
    enforcedBy: RESPONSES,
  },
  { schema: "CreateResponseRequest", path: "$.tags", keyword: "uniqueItems", enforcedBy: RESPONSES },
  { schema: "CreateResponseRequest", path: "$.ttc", keyword: "maxProperties", enforcedBy: RESPONSES },
  { schema: "PatchResponseRequest", path: "$", keyword: "minProperties", enforcedBy: RESPONSES },
  { schema: "PatchResponseRequest", path: "$.data", keyword: "maxProperties", enforcedBy: RESPONSES },
  { schema: "PatchResponseRequest", path: "$.data{}", keyword: "conditional", enforcedBy: RESPONSES },
  { schema: "PatchResponseRequest", path: "$.embeddedData", keyword: "maxProperties", enforcedBy: RESPONSES },
  { schema: "ResponseDataMapInput", path: "$", keyword: "maxProperties", enforcedBy: RESPONSES },
  { schema: "ResponseDataMapInput", path: "${}", keyword: "conditional", enforcedBy: RESPONSES },
  { schema: "ResponseEmbeddedDataInput", path: "$", keyword: "maxProperties", enforcedBy: RESPONSES },
  { schema: "ResponseTtcMap", path: "$", keyword: "maxProperties", enforcedBy: RESPONSES },
];
