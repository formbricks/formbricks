import { describe, expect, test } from "vitest";
import { zResponseAnswerComposite } from "@formbricks/api-v3-schemas";
import {
  diffAgainstSpec,
  isJsonObject,
  readBundle,
  resolvePointer,
} from "@formbricks/api-v3-schemas/testing";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import {
  V3_ADDRESS_FIELD_IDS,
  V3_CONTACT_INFO_FIELD_IDS,
  V3_ELEMENT_TYPES,
  ZV3ResponseAnswer,
  ZV3ResponseListItem,
  ZV3ResponseResource,
} from "./resources";

/**
 * What generation cannot prove about the response payload.
 *
 * The schemas are generated from the contract, so the field-for-field comparison the old drift test
 * made is now structural, and `@formbricks/api-v3-schemas` checks it for every component. What is
 * left is the contract's agreement with things outside it — the survey model, the storage layout — and
 * the one composition this resource adds on top of the generated schemas.
 */
const bundle = readBundle();
const sorted = (values: Iterable<string>) => [...values].sort();

describe("v3 response contract", () => {
  /**
   * `elementType` is the hinge the answer union turns on. Add an element type to the product without
   * adding it to the contract, and every response to that element would serialize as
   * `elementNotInSurvey` while every other test stayed green.
   */
  test("the contract's element types are exactly the survey model's", () => {
    expect(sorted(V3_ELEMENT_TYPES)).toEqual(sorted(Object.values(TSurveyElementTypeEnum)));
  });

  test("every element type dispatches to exactly one answer variant", () => {
    const answer = resolvePointer(bundle, "#/components/schemas/ResponseAnswer");
    const mapping =
      isJsonObject(answer) && isJsonObject(answer.discriminator) && isJsonObject(answer.discriminator.mapping)
        ? Object.keys(answer.discriminator.mapping)
        : [];
    expect(sorted(mapping)).toEqual(sorted(V3_ELEMENT_TYPES));

    for (const elementType of V3_ELEMENT_TYPES) {
      const accepting = ZV3ResponseAnswer.options.filter(
        (option) => option.shape.elementType.safeParse(elementType).success
      );
      expect(accepting, elementType).toHaveLength(1);
    }
  });

  /**
   * The composite sub-field ids are ordered, not merely a set: `address` and `contactInfo` are stored as
   * positional arrays, so slot N only means anything against these lists in this order. The split lives
   * in code; the order is published by the contract, and the two must agree position for position.
   */
  test("the composite fieldId enum keeps the storage order of both composites", () => {
    const fieldIds = zResponseAnswerComposite.shape.fields.element.shape.fieldId.options;
    expect(fieldIds).toEqual([...V3_ADDRESS_FIELD_IDS, ...V3_CONTACT_INFO_FIELD_IDS]);
  });

  test("the two views differ by exactly the four fields the detail read adds", () => {
    const list = new Set(Object.keys(ZV3ResponseListItem.shape));
    const detail = new Set(Object.keys(ZV3ResponseResource.shape));

    expect(sorted([...detail].filter((key) => !list.has(key)))).toEqual([
      "contact",
      "data",
      "displayId",
      "singleUseId",
    ]);
    expect([...list].filter((key) => !detail.has(key))).toEqual([]);
  });

  /**
   * The read views re-wrap the generated answer union as a discriminated one. These are the schemas the
   * serializers are typed against and that MCP validates every structured result with, so they — not
   * only the generated ones — must match the contract exactly, at every depth.
   */
  test.each([
    ["ResponseListItem", ZV3ResponseListItem],
    ["ResponseResource", ZV3ResponseResource],
  ])("%s matches the contract at every depth", (name, schema) => {
    expect(diffAgainstSpec(bundle, { $ref: `#/components/schemas/${name}` }, schema)).toEqual([]);
  });
});
