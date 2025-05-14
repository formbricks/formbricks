import { createId } from "@paralleldrive/cuid2";
import { describe, expect, test, vi } from "vitest";
import {
  TBaseFilter,
  TBaseFilters,
  TSegment,
  TSegmentAttributeFilter,
  TSegmentDeviceFilter,
  TSegmentFilter,
  TSegmentPersonFilter,
  TSegmentSegmentFilter,
} from "@formbricks/types/segment";
import {
  addFilterBelow,
  addFilterInGroup,
  convertOperatorToText,
  convertOperatorToTitle,
  createGroupFromResource,
  deleteEmptyGroups,
  deleteResource,
  formatSegmentDateFields,
  isAdvancedSegment,
  isResourceFilter,
  moveResource,
  searchForAttributeKeyInSegment,
  toggleFilterConnector,
  toggleGroupConnector,
  updateContactAttributeKeyInFilter,
  updateDeviceTypeInFilter,
  updateFilterValue,
  updateOperatorInFilter,
  updatePersonIdentifierInFilter,
  updateSegmentIdInFilter,
} from "./utils";

// Mock createId
vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(),
}));

// Helper function to create a mock filter
const createMockFilter = (
  id: string,
  type: "attribute" | "person" | "segment" | "device"
): TSegmentFilter => {
  const base = {
    id,
    root: { type },
    qualifier: { operator: "equals" as const },
    value: "someValue",
  };
  if (type === "attribute") {
    return { ...base, root: { type, contactAttributeKey: "email" } } as TSegmentAttributeFilter;
  }
  if (type === "person") {
    return { ...base, root: { type, personIdentifier: "userId" } } as TSegmentPersonFilter;
  }
  if (type === "segment") {
    return {
      ...base,
      root: { type, segmentId: "seg1" },
      qualifier: { operator: "userIsIn" as const },
      value: "seg1",
    } as TSegmentSegmentFilter;
  }
  if (type === "device") {
    return { ...base, root: { type, deviceType: "desktop" }, value: "desktop" } as TSegmentDeviceFilter;
  }
  throw new Error("Invalid filter type");
};

// Helper function to create a base filter structure
const createBaseFilter = (
  resource: TSegmentFilter | TBaseFilters,
  connector: "and" | "or" | null = "and",
  id?: string
): TBaseFilter => ({
  id: id ?? (isResourceFilter(resource) ? resource.id : `group-${Math.random()}`), // Use filter ID or random for group
  connector,
  resource,
});

describe("Segment Utils", () => {
  test("isResourceFilter", () => {
    const filter = createMockFilter("f1", "attribute");
    const baseFilter = createBaseFilter(filter);
    const group = createBaseFilter([baseFilter]);

    expect(isResourceFilter(filter)).toBe(true);
    expect(isResourceFilter(group.resource)).toBe(false);
    expect(isResourceFilter(baseFilter.resource)).toBe(true);
  });

  test("convertOperatorToText", () => {
    expect(convertOperatorToText("equals")).toBe("=");
    expect(convertOperatorToText("notEquals")).toBe("!=");
    expect(convertOperatorToText("lessThan")).toBe("<");
    expect(convertOperatorToText("lessEqual")).toBe("<=");
    expect(convertOperatorToText("greaterThan")).toBe(">");
    expect(convertOperatorToText("greaterEqual")).toBe(">=");
    expect(convertOperatorToText("isSet")).toBe("is set");
    expect(convertOperatorToText("isNotSet")).toBe("is not set");
    expect(convertOperatorToText("contains")).toBe("contains ");
    expect(convertOperatorToText("doesNotContain")).toBe("does not contain");
    expect(convertOperatorToText("startsWith")).toBe("starts with");
    expect(convertOperatorToText("endsWith")).toBe("ends with");
    expect(convertOperatorToText("userIsIn")).toBe("User is in");
    expect(convertOperatorToText("userIsNotIn")).toBe("User is not in");
    // @ts-expect-error - testing default case
    expect(convertOperatorToText("unknown")).toBe("unknown");
  });

  test("convertOperatorToTitle", () => {
    expect(convertOperatorToTitle("equals")).toBe("Equals");
    expect(convertOperatorToTitle("notEquals")).toBe("Not equals to");
    expect(convertOperatorToTitle("lessThan")).toBe("Less than");
    expect(convertOperatorToTitle("lessEqual")).toBe("Less than or equal to");
    expect(convertOperatorToTitle("greaterThan")).toBe("Greater than");
    expect(convertOperatorToTitle("greaterEqual")).toBe("Greater than or equal to");
    expect(convertOperatorToTitle("isSet")).toBe("Is set");
    expect(convertOperatorToTitle("isNotSet")).toBe("Is not set");
    expect(convertOperatorToTitle("contains")).toBe("Contains");
    expect(convertOperatorToTitle("doesNotContain")).toBe("Does not contain");
    expect(convertOperatorToTitle("startsWith")).toBe("Starts with");
    expect(convertOperatorToTitle("endsWith")).toBe("Ends with");
    expect(convertOperatorToTitle("userIsIn")).toBe("User is in");
    expect(convertOperatorToTitle("userIsNotIn")).toBe("User is not in");
    // @ts-expect-error - testing default case
    expect(convertOperatorToTitle("unknown")).toBe("unknown");
  });

  test("addFilterBelow", () => {
    const filter1 = createMockFilter("f1", "attribute");
    const filter2 = createMockFilter("f2", "person");
    const newFilter = createMockFilter("f3", "segment");
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const baseFilter2 = createBaseFilter(filter2, "and", "bf2");
    const newBaseFilter = createBaseFilter(newFilter, "or", "bf3");

    const group: TBaseFilters = [baseFilter1, baseFilter2];
    addFilterBelow(group, "f1", newBaseFilter);
    expect(group).toEqual([baseFilter1, newBaseFilter, baseFilter2]);

    const nestedFilter = createMockFilter("nf1", "device");
    const nestedBaseFilter = createBaseFilter(nestedFilter, null, "nbf1");
    const nestedGroup = createBaseFilter([nestedBaseFilter], "or", "ng1");
    const groupWithNested: TBaseFilters = [baseFilter1, nestedGroup];
    const newFilterForNested = createMockFilter("nf2", "attribute");
    const newBaseFilterForNested = createBaseFilter(newFilterForNested, "and", "nbf2");

    addFilterBelow(groupWithNested, "nf1", newBaseFilterForNested);
    expect((groupWithNested[1].resource as TBaseFilters)[1]).toEqual(newBaseFilterForNested);

    const group3: TBaseFilters = [baseFilter1, nestedGroup];
    const newFilterBelowGroup = createMockFilter("f4", "person");
    const newBaseFilterBelowGroup = createBaseFilter(newFilterBelowGroup, "and", "bf4");
    addFilterBelow(group3, "ng1", newBaseFilterBelowGroup);
    expect(group3).toEqual([baseFilter1, nestedGroup, newBaseFilterBelowGroup]);
  });

  test("createGroupFromResource", () => {
    vi.mocked(createId).mockReturnValue("newGroupId");

    const filter1 = createMockFilter("f1", "attribute");
    const filter2 = createMockFilter("f2", "person");
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const baseFilter2 = createBaseFilter(filter2, "and", "bf2");
    const group: TBaseFilters = [baseFilter1, baseFilter2];

    createGroupFromResource(group, "f1");
    expect(group[0].id).toBe("newGroupId");
    expect(group[0].connector).toBeNull();
    expect(isResourceFilter(group[0].resource)).toBe(false);
    expect((group[0].resource as TBaseFilters)[0].resource).toEqual(filter1);
    expect((group[0].resource as TBaseFilters)[0].connector).toBeNull();
    expect(group[1]).toEqual(baseFilter2);

    const nestedFilter = createMockFilter("nf1", "device");
    const nestedBaseFilter = createBaseFilter(nestedFilter, null, "nbf1");
    const initialNestedGroup = createBaseFilter([nestedBaseFilter], "or", "ng1");
    const groupWithNested: TBaseFilters = [baseFilter1, initialNestedGroup];

    vi.mocked(createId).mockReturnValue("outerGroupId");
    createGroupFromResource(groupWithNested, "ng1");

    expect(groupWithNested[1].id).toBe("outerGroupId");
    expect(groupWithNested[1].connector).toBe("or");
    expect(isResourceFilter(groupWithNested[1].resource)).toBe(false);
    const outerGroupResource = groupWithNested[1].resource as TBaseFilters;
    expect(outerGroupResource.length).toBe(1);
    expect(outerGroupResource[0].id).toBe("ng1");
    expect(outerGroupResource[0].connector).toBeNull();
    expect(outerGroupResource[0].resource).toEqual([nestedBaseFilter]);

    const filter3 = createMockFilter("f3", "segment");
    const baseFilter3 = createBaseFilter(filter3, "and", "bf3");
    const nestedGroup2: TBaseFilters = [nestedBaseFilter, baseFilter3];
    const initialNestedGroup2 = createBaseFilter(nestedGroup2, "or", "ng2");
    const groupWithNested2: TBaseFilters = [baseFilter1, initialNestedGroup2];

    vi.mocked(createId).mockReturnValue("newInnerGroupId");
    createGroupFromResource(groupWithNested2, "nf1");

    const targetGroup = groupWithNested2[1].resource as TBaseFilters;
    expect(targetGroup[0].id).toBe("newInnerGroupId");
    expect(targetGroup[0].connector).toBeNull();
    expect(isResourceFilter(targetGroup[0].resource)).toBe(false);
    expect((targetGroup[0].resource as TBaseFilters)[0].resource).toEqual(nestedFilter);
    expect((targetGroup[0].resource as TBaseFilters)[0].connector).toBeNull();
    expect(targetGroup[1]).toEqual(baseFilter3);
  });

  test("moveResource", () => {
    // Initial setup for filter moving
    const filter1_orig = createMockFilter("f1", "attribute");
    const filter2_orig = createMockFilter("f2", "person");
    const filter3_orig = createMockFilter("f3", "segment");
    const baseFilter1_orig = createBaseFilter(filter1_orig, null, "bf1");
    const baseFilter2_orig = createBaseFilter(filter2_orig, "and", "bf2");
    const baseFilter3_orig = createBaseFilter(filter3_orig, "or", "bf3");
    let group: TBaseFilters = [baseFilter1_orig, baseFilter2_orig, baseFilter3_orig];

    // Test moving filters up/down
    moveResource(group, "f2", "up");
    // Expected: [bf2(null), bf1(and), bf3(or)]
    expect(group[0].id).toBe("bf2");
    expect(group[0].connector).toBeNull();
    expect(group[1].id).toBe("bf1");
    expect(group[1].connector).toBe("and");
    expect(group[2].id).toBe("bf3");

    moveResource(group, "f2", "up"); // Move first up (no change)
    expect(group[0].id).toBe("bf2");
    expect(group[0].connector).toBeNull();
    expect(group[1].id).toBe("bf1");
    expect(group[1].connector).toBe("and");

    moveResource(group, "f1", "down"); // Move bf1 (index 1) down
    // Expected: [bf2(null), bf3(or), bf1(and)]
    expect(group[0].id).toBe("bf2");
    expect(group[0].connector).toBeNull();
    expect(group[1].id).toBe("bf3");
    expect(group[1].connector).toBe("or");
    expect(group[2].id).toBe("bf1");
    expect(group[2].connector).toBe("and");

    moveResource(group, "f1", "down"); // Move last down (no change)
    expect(group[2].id).toBe("bf1");
    expect(group[2].connector).toBe("and");

    // Setup for nested filter moving
    const nestedFilter1_orig = createMockFilter("nf1", "device");
    const nestedFilter2_orig = createMockFilter("nf2", "attribute");
    // Use fresh baseFilter1 to avoid state pollution from previous tests
    const baseFilter1_fresh_nested = createBaseFilter(createMockFilter("f1", "attribute"), null, "bf1");
    const nestedBaseFilter1_orig = createBaseFilter(nestedFilter1_orig, null, "nbf1");
    const nestedBaseFilter2_orig = createBaseFilter(nestedFilter2_orig, "and", "nbf2");
    const nestedGroup_orig = createBaseFilter([nestedBaseFilter1_orig, nestedBaseFilter2_orig], "or", "ng1");
    const groupWithNested: TBaseFilters = [baseFilter1_fresh_nested, nestedGroup_orig];

    moveResource(groupWithNested, "nf2", "up"); // Move nf2 up within nested group
    const innerGroup = groupWithNested[1].resource as TBaseFilters;
    expect(innerGroup[0].id).toBe("nbf2");
    expect(innerGroup[0].connector).toBeNull();
    expect(innerGroup[1].id).toBe("nbf1");
    expect(innerGroup[1].connector).toBe("and");

    // Setup for moving groups - Ensure fresh state here
    const filter1_group = createMockFilter("f1", "attribute");
    const filter3_group = createMockFilter("f3", "segment");
    const nestedFilter1_group = createMockFilter("nf1", "device");
    const nestedFilter2_group = createMockFilter("nf2", "attribute");

    const baseFilter1_group = createBaseFilter(filter1_group, null, "bf1"); // Fresh, connector null
    const nestedBaseFilter1_group = createBaseFilter(nestedFilter1_group, null, "nbf1");
    const nestedBaseFilter2_group = createBaseFilter(nestedFilter2_group, "and", "nbf2");
    const nestedGroup_group = createBaseFilter(
      [nestedBaseFilter1_group, nestedBaseFilter2_group],
      "or",
      "ng1"
    ); // Fresh, connector 'or'
    const baseFilter3_group = createBaseFilter(filter3_group, "or", "bf3"); // Fresh, connector 'or'

    const groupToMove: TBaseFilters = [baseFilter1_group, nestedGroup_group, baseFilter3_group];
    // Initial state: [bf1(null), ng1(or), bf3(or)]

    moveResource(groupToMove, "ng1", "down"); // Move ng1 (index 1) down
    // Expected state: [bf1(null), bf3(or), ng1(or)]
    expect(groupToMove[0].id).toBe("bf1");
    expect(groupToMove[0].connector).toBeNull(); // Should pass now
    expect(groupToMove[1].id).toBe("bf3");
    expect(groupToMove[1].connector).toBe("or");
    expect(groupToMove[2].id).toBe("ng1");
    expect(groupToMove[2].connector).toBe("or");

    moveResource(groupToMove, "ng1", "up"); // Move ng1 (index 2) up
    // Expected state: [bf1(null), ng1(or), bf3(or)]
    expect(groupToMove[0].id).toBe("bf1");
    expect(groupToMove[0].connector).toBeNull();
    expect(groupToMove[1].id).toBe("ng1");
    expect(groupToMove[1].connector).toBe("or");
    expect(groupToMove[2].id).toBe("bf3");
    expect(groupToMove[2].connector).toBe("or");
  });

  test("deleteResource", () => {
    // Scenario 1: Delete middle filter
    let filter1_s1 = createMockFilter("f1", "attribute");
    let filter2_s1 = createMockFilter("f2", "person");
    let filter3_s1 = createMockFilter("f3", "segment");
    let baseFilter1_s1 = createBaseFilter(filter1_s1, null, "bf1");
    let baseFilter2_s1 = createBaseFilter(filter2_s1, "and", "bf2");
    let baseFilter3_s1 = createBaseFilter(filter3_s1, "or", "bf3");
    let group_s1: TBaseFilters = [baseFilter1_s1, baseFilter2_s1, baseFilter3_s1];
    deleteResource(group_s1, "f2");
    expect(group_s1.length).toBe(2);
    expect(group_s1[0].id).toBe("bf1");
    expect(group_s1[0].connector).toBeNull();
    expect(group_s1[1].id).toBe("bf3");
    expect(group_s1[1].connector).toBe("or");

    // Scenario 2: Delete first filter
    let filter1_s2 = createMockFilter("f1", "attribute");
    let filter2_s2 = createMockFilter("f2", "person");
    let filter3_s2 = createMockFilter("f3", "segment");
    let baseFilter1_s2 = createBaseFilter(filter1_s2, null, "bf1");
    let baseFilter2_s2 = createBaseFilter(filter2_s2, "and", "bf2");
    let baseFilter3_s2 = createBaseFilter(filter3_s2, "or", "bf3");
    let group_s2: TBaseFilters = [baseFilter1_s2, baseFilter2_s2, baseFilter3_s2];
    deleteResource(group_s2, "f1");
    expect(group_s2.length).toBe(2);
    expect(group_s2[0].id).toBe("bf2");
    expect(group_s2[0].connector).toBeNull(); // Connector becomes null
    expect(group_s2[1].id).toBe("bf3");
    expect(group_s2[1].connector).toBe("or");

    // Scenario 3: Delete last filter
    let filter1_s3 = createMockFilter("f1", "attribute");
    let filter2_s3 = createMockFilter("f2", "person");
    let filter3_s3 = createMockFilter("f3", "segment");
    let baseFilter1_s3 = createBaseFilter(filter1_s3, null, "bf1");
    let baseFilter2_s3 = createBaseFilter(filter2_s3, "and", "bf2");
    let baseFilter3_s3 = createBaseFilter(filter3_s3, "or", "bf3");
    let group_s3: TBaseFilters = [baseFilter1_s3, baseFilter2_s3, baseFilter3_s3];
    deleteResource(group_s3, "f3");
    expect(group_s3.length).toBe(2);
    expect(group_s3[0].id).toBe("bf1");
    expect(group_s3[0].connector).toBeNull();
    expect(group_s3[1].id).toBe("bf2");
    expect(group_s3[1].connector).toBe("and"); // Should pass now

    // Scenario 4: Delete only filter
    let filter1_s4 = createMockFilter("f1", "attribute");
    let baseFilter1_s4 = createBaseFilter(filter1_s4, null, "bf1");
    let group_s4: TBaseFilters = [baseFilter1_s4];
    deleteResource(group_s4, "f1");
    expect(group_s4).toEqual([]);

    // Scenario 5: Delete filter in nested group
    let filter1_s5 = createMockFilter("f1", "attribute"); // Outer filter
    let nestedFilter1_s5 = createMockFilter("nf1", "device");
    let nestedFilter2_s5 = createMockFilter("nf2", "attribute");
    let baseFilter1_s5 = createBaseFilter(filter1_s5, null, "bf1");
    let nestedBaseFilter1_s5 = createBaseFilter(nestedFilter1_s5, null, "nbf1");
    let nestedBaseFilter2_s5 = createBaseFilter(nestedFilter2_s5, "and", "nbf2");
    let nestedGroup_s5 = createBaseFilter([nestedBaseFilter1_s5, nestedBaseFilter2_s5], "or", "ng1");
    let groupWithNested_s5: TBaseFilters = [baseFilter1_s5, nestedGroup_s5];

    deleteResource(groupWithNested_s5, "nf1");
    let innerGroup_s5 = groupWithNested_s5[1].resource as TBaseFilters;
    expect(innerGroup_s5.length).toBe(1);
    expect(innerGroup_s5[0].id).toBe("nbf2");
    expect(innerGroup_s5[0].connector).toBeNull(); // Connector becomes null

    // Scenario 6: Delete filter that makes group empty, then delete the empty group
    // Continue from Scenario 5 state
    deleteResource(groupWithNested_s5, "nf2");
    expect(groupWithNested_s5.length).toBe(1);
    expect(groupWithNested_s5[0].id).toBe("bf1"); // Empty group ng1 should be deleted

    // Scenario 7: Delete a group directly
    let filter1_s7 = createMockFilter("f1", "attribute");
    let filter3_s7 = createMockFilter("f3", "segment");
    let nestedFilter1_s7 = createMockFilter("nf1", "device");
    let nestedFilter2_s7 = createMockFilter("nf2", "attribute");
    let baseFilter1_s7 = createBaseFilter(filter1_s7, null, "bf1");
    let nestedBaseFilter1_s7 = createBaseFilter(nestedFilter1_s7, null, "nbf1");
    let nestedBaseFilter2_s7 = createBaseFilter(nestedFilter2_s7, "and", "nbf2");
    let nestedGroup_s7 = createBaseFilter([nestedBaseFilter1_s7, nestedBaseFilter2_s7], "or", "ng1");
    let baseFilter3_s7 = createBaseFilter(filter3_s7, "or", "bf3");
    const groupToDelete_s7: TBaseFilters = [baseFilter1_s7, nestedGroup_s7, baseFilter3_s7];

    deleteResource(groupToDelete_s7, "ng1");
    expect(groupToDelete_s7.length).toBe(2);
    expect(groupToDelete_s7[0].id).toBe("bf1");
    expect(groupToDelete_s7[0].connector).toBeNull();
    expect(groupToDelete_s7[1].id).toBe("bf3");
    expect(groupToDelete_s7[1].connector).toBe("or"); // Connector from bf3 remains
  });

  test("deleteEmptyGroups", () => {
    const filter1 = createMockFilter("f1", "attribute");
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const emptyGroup1 = createBaseFilter([], "and", "eg1");
    const nestedEmptyGroup = createBaseFilter([], "or", "neg1");
    const groupWithEmptyNested = createBaseFilter([nestedEmptyGroup], "and", "gwen1");
    const group: TBaseFilters = [baseFilter1, emptyGroup1, groupWithEmptyNested];

    deleteEmptyGroups(group);

    // Now expect the correct behavior: all empty groups are removed.
    const expectedCorrectResult = [baseFilter1];

    expect(group).toEqual(expectedCorrectResult);
  });

  test("addFilterInGroup", () => {
    const filter1 = createMockFilter("f1", "attribute");
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const emptyGroup = createBaseFilter([], "and", "eg1");
    const nestedFilter = createMockFilter("nf1", "device");
    const nestedBaseFilter = createBaseFilter(nestedFilter, null, "nbf1");
    const nestedGroup = createBaseFilter([nestedBaseFilter], "or", "ng1");
    const group: TBaseFilters = [baseFilter1, emptyGroup, nestedGroup];

    const newFilter1 = createMockFilter("newF1", "person");
    const newBaseFilter1 = createBaseFilter(newFilter1, "and", "newBf1");
    addFilterInGroup(group, "eg1", newBaseFilter1);
    expect(group[1].resource as TBaseFilters).toEqual([{ ...newBaseFilter1, connector: null }]); // First filter in group has null connector

    const newFilter2 = createMockFilter("newF2", "segment");
    const newBaseFilter2 = createBaseFilter(newFilter2, "or", "newBf2");
    addFilterInGroup(group, "ng1", newBaseFilter2);
    expect(group[2].resource as TBaseFilters).toEqual([nestedBaseFilter, newBaseFilter2]);
    expect((group[2].resource as TBaseFilters)[1].connector).toBe("or");
  });

  test("toggleGroupConnector", () => {
    const filter1 = createMockFilter("f1", "attribute");
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const nestedFilter = createMockFilter("nf1", "device");
    const nestedBaseFilter = createBaseFilter(nestedFilter, null, "nbf1");
    const nestedGroup = createBaseFilter([nestedBaseFilter], "or", "ng1");
    const group: TBaseFilters = [baseFilter1, nestedGroup];

    toggleGroupConnector(group, "ng1", "and");
    expect(group[1].connector).toBe("and");

    // Toggle connector of a non-existent group (should do nothing)
    toggleGroupConnector(group, "nonExistent", "and");
    expect(group[1].connector).toBe("and");
  });

  test("toggleFilterConnector", () => {
    const filter1 = createMockFilter("f1", "attribute");
    const filter2 = createMockFilter("f2", "person");
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const baseFilter2 = createBaseFilter(filter2, "and", "bf2");
    const nestedFilter = createMockFilter("nf1", "device");
    const nestedBaseFilter = createBaseFilter(nestedFilter, "or", "nbf1");
    const nestedGroup = createBaseFilter([nestedBaseFilter], "and", "ng1");
    const group: TBaseFilters = [baseFilter1, baseFilter2, nestedGroup];

    toggleFilterConnector(group, "f2", "or");
    expect(group[1].connector).toBe("or");

    toggleFilterConnector(group, "nf1", "and");
    expect((group[2].resource as TBaseFilters)[0].connector).toBe("and");

    // Toggle connector of a non-existent filter (should do nothing)
    toggleFilterConnector(group, "nonExistent", "and");
    expect(group[1].connector).toBe("or");
    expect((group[2].resource as TBaseFilters)[0].connector).toBe("and");
  });

  test("updateOperatorInFilter", () => {
    const filter1 = createMockFilter("f1", "attribute");
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const nestedFilter = createMockFilter("nf1", "device");
    const nestedBaseFilter = createBaseFilter(nestedFilter, null, "nbf1");
    const nestedGroup = createBaseFilter([nestedBaseFilter], "or", "ng1");
    const group: TBaseFilters = [baseFilter1, nestedGroup];

    updateOperatorInFilter(group, "f1", "notEquals");
    expect((group[0].resource as TSegmentFilter).qualifier.operator).toBe("notEquals");

    updateOperatorInFilter(group, "nf1", "isSet");
    expect(((group[1].resource as TBaseFilters)[0].resource as TSegmentFilter).qualifier.operator).toBe(
      "isSet"
    );

    // Update operator of non-existent filter (should do nothing)
    updateOperatorInFilter(group, "nonExistent", "contains");
    expect((group[0].resource as TSegmentFilter).qualifier.operator).toBe("notEquals");
    expect(((group[1].resource as TBaseFilters)[0].resource as TSegmentFilter).qualifier.operator).toBe(
      "isSet"
    );
  });

  test("updateContactAttributeKeyInFilter", () => {
    const filter1 = createMockFilter("f1", "attribute");
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const nestedFilter = createMockFilter("nf1", "attribute");
    const nestedBaseFilter = createBaseFilter(nestedFilter, null, "nbf1");
    const nestedGroup = createBaseFilter([nestedBaseFilter], "or", "ng1");
    const group: TBaseFilters = [baseFilter1, nestedGroup];

    updateContactAttributeKeyInFilter(group, "f1", "newKey1");
    expect((group[0].resource as TSegmentAttributeFilter).root.contactAttributeKey).toBe("newKey1");

    updateContactAttributeKeyInFilter(group, "nf1", "newKey2");
    expect(
      ((group[1].resource as TBaseFilters)[0].resource as TSegmentAttributeFilter).root.contactAttributeKey
    ).toBe("newKey2");

    // Update key of non-existent filter (should do nothing)
    updateContactAttributeKeyInFilter(group, "nonExistent", "anotherKey");
    expect((group[0].resource as TSegmentAttributeFilter).root.contactAttributeKey).toBe("newKey1");
    expect(
      ((group[1].resource as TBaseFilters)[0].resource as TSegmentAttributeFilter).root.contactAttributeKey
    ).toBe("newKey2");
  });

  test("updatePersonIdentifierInFilter", () => {
    const filter1 = createMockFilter("f1", "person");
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const nestedFilter = createMockFilter("nf1", "person");
    const nestedBaseFilter = createBaseFilter(nestedFilter, null, "nbf1");
    const nestedGroup = createBaseFilter([nestedBaseFilter], "or", "ng1");
    const group: TBaseFilters = [baseFilter1, nestedGroup];

    updatePersonIdentifierInFilter(group, "f1", "newId1");
    expect((group[0].resource as TSegmentPersonFilter).root.personIdentifier).toBe("newId1");

    updatePersonIdentifierInFilter(group, "nf1", "newId2");
    expect(
      ((group[1].resource as TBaseFilters)[0].resource as TSegmentPersonFilter).root.personIdentifier
    ).toBe("newId2");

    // Update identifier of non-existent filter (should do nothing)
    updatePersonIdentifierInFilter(group, "nonExistent", "anotherId");
    expect((group[0].resource as TSegmentPersonFilter).root.personIdentifier).toBe("newId1");
    expect(
      ((group[1].resource as TBaseFilters)[0].resource as TSegmentPersonFilter).root.personIdentifier
    ).toBe("newId2");
  });

  test("updateSegmentIdInFilter", () => {
    const filter1 = createMockFilter("f1", "segment");
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const nestedFilter = createMockFilter("nf1", "segment");
    const nestedBaseFilter = createBaseFilter(nestedFilter, null, "nbf1");
    const nestedGroup = createBaseFilter([nestedBaseFilter], "or", "ng1");
    const group: TBaseFilters = [baseFilter1, nestedGroup];

    updateSegmentIdInFilter(group, "f1", "newSegId1");
    expect((group[0].resource as TSegmentSegmentFilter).root.segmentId).toBe("newSegId1");
    expect((group[0].resource as TSegmentSegmentFilter).value).toBe("newSegId1");

    updateSegmentIdInFilter(group, "nf1", "newSegId2");
    expect(((group[1].resource as TBaseFilters)[0].resource as TSegmentSegmentFilter).root.segmentId).toBe(
      "newSegId2"
    );
    expect(((group[1].resource as TBaseFilters)[0].resource as TSegmentSegmentFilter).value).toBe(
      "newSegId2"
    );

    // Update segment ID of non-existent filter (should do nothing)
    updateSegmentIdInFilter(group, "nonExistent", "anotherSegId");
    expect((group[0].resource as TSegmentSegmentFilter).root.segmentId).toBe("newSegId1");
    expect(((group[1].resource as TBaseFilters)[0].resource as TSegmentSegmentFilter).root.segmentId).toBe(
      "newSegId2"
    );
  });

  test("updateFilterValue", () => {
    const filter1 = createMockFilter("f1", "attribute");
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const nestedFilter = createMockFilter("nf1", "person");
    const nestedBaseFilter = createBaseFilter(nestedFilter, null, "nbf1");
    const nestedGroup = createBaseFilter([nestedBaseFilter], "or", "ng1");
    const group: TBaseFilters = [baseFilter1, nestedGroup];

    updateFilterValue(group, "f1", "newValue1");
    expect((group[0].resource as TSegmentFilter).value).toBe("newValue1");

    updateFilterValue(group, "nf1", 123);
    expect(((group[1].resource as TBaseFilters)[0].resource as TSegmentFilter).value).toBe(123);

    // Update value of non-existent filter (should do nothing)
    updateFilterValue(group, "nonExistent", "anotherValue");
    expect((group[0].resource as TSegmentFilter).value).toBe("newValue1");
    expect(((group[1].resource as TBaseFilters)[0].resource as TSegmentFilter).value).toBe(123);
  });

  test("updateDeviceTypeInFilter", () => {
    const filter1 = createMockFilter("f1", "device");
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const nestedFilter = createMockFilter("nf1", "device");
    const nestedBaseFilter = createBaseFilter(nestedFilter, null, "nbf1");
    const nestedGroup = createBaseFilter([nestedBaseFilter], "or", "ng1");
    const group: TBaseFilters = [baseFilter1, nestedGroup];

    updateDeviceTypeInFilter(group, "f1", "phone");
    expect((group[0].resource as TSegmentDeviceFilter).root.deviceType).toBe("phone");
    expect((group[0].resource as TSegmentDeviceFilter).value).toBe("phone");

    updateDeviceTypeInFilter(group, "nf1", "desktop");
    expect(((group[1].resource as TBaseFilters)[0].resource as TSegmentDeviceFilter).root.deviceType).toBe(
      "desktop"
    );
    expect(((group[1].resource as TBaseFilters)[0].resource as TSegmentDeviceFilter).value).toBe("desktop");

    // Update device type of non-existent filter (should do nothing)
    updateDeviceTypeInFilter(group, "nonExistent", "phone");
    expect((group[0].resource as TSegmentDeviceFilter).root.deviceType).toBe("phone");
    expect(((group[1].resource as TBaseFilters)[0].resource as TSegmentDeviceFilter).root.deviceType).toBe(
      "desktop"
    );
  });

  test("formatSegmentDateFields", () => {
    const dateString = "2023-01-01T12:00:00.000Z";
    const segment: TSegment = {
      id: "seg1",
      title: "Test Segment",
      description: "Desc",
      isPrivate: false,
      environmentId: "env1",
      surveys: ["survey1"],
      filters: [],
      createdAt: dateString as any, // Cast to any to simulate string input
      updatedAt: dateString as any, // Cast to any to simulate string input
    };

    const formattedSegment = formatSegmentDateFields(segment);
    expect(formattedSegment.createdAt).toBeInstanceOf(Date);
    expect(formattedSegment.updatedAt).toBeInstanceOf(Date);
    expect(formattedSegment.createdAt.toISOString()).toBe(dateString);
    expect(formattedSegment.updatedAt.toISOString()).toBe(dateString);

    // Test with Date objects already (should not change)
    const dateObj = new Date(dateString);
    const segmentWithDates: TSegment = { ...segment, createdAt: dateObj, updatedAt: dateObj };
    const formattedSegment2 = formatSegmentDateFields(segmentWithDates);
    expect(formattedSegment2.createdAt).toBe(dateObj);
    expect(formattedSegment2.updatedAt).toBe(dateObj);
  });

  test("searchForAttributeKeyInSegment", () => {
    const filter1 = createMockFilter("f1", "attribute"); // key: 'email'
    const filter2 = createMockFilter("f2", "person");
    const filter3 = createMockFilter("f3", "attribute");
    (filter3 as TSegmentAttributeFilter).root.contactAttributeKey = "company";
    const baseFilter1 = createBaseFilter(filter1, null, "bf1");
    const baseFilter2 = createBaseFilter(filter2, "and", "bf2");
    const baseFilter3 = createBaseFilter(filter3, "or", "bf3");
    const nestedFilter = createMockFilter("nf1", "attribute");
    (nestedFilter as TSegmentAttributeFilter).root.contactAttributeKey = "role";
    const nestedBaseFilter = createBaseFilter(nestedFilter, null, "nbf1");
    const nestedGroup = createBaseFilter([nestedBaseFilter], "and", "ng1");
    const group: TBaseFilters = [baseFilter1, baseFilter2, nestedGroup, baseFilter3];

    expect(searchForAttributeKeyInSegment(group, "email")).toBe(true);
    expect(searchForAttributeKeyInSegment(group, "company")).toBe(true);
    expect(searchForAttributeKeyInSegment(group, "role")).toBe(true);
    expect(searchForAttributeKeyInSegment(group, "nonExistentKey")).toBe(false);
    expect(searchForAttributeKeyInSegment([], "anyKey")).toBe(false); // Empty filters
  });

  test("isAdvancedSegment", () => {
    const attrFilter = createMockFilter("f_attr", "attribute");
    const personFilter = createMockFilter("f_person", "person");
    const deviceFilter = createMockFilter("f_device", "device");
    const segmentFilter = createMockFilter("f_segment", "segment");

    const baseAttr = createBaseFilter(attrFilter, null);
    const basePerson = createBaseFilter(personFilter, "and");
    const baseDevice = createBaseFilter(deviceFilter, "and");
    const baseSegment = createBaseFilter(segmentFilter, "or");

    // Only attribute/person filters
    const basicFilters: TBaseFilters = [baseAttr, basePerson];
    expect(isAdvancedSegment(basicFilters)).toBe(false);

    // Contains a device filter
    const deviceFilters: TBaseFilters = [baseAttr, baseDevice];
    expect(isAdvancedSegment(deviceFilters)).toBe(true);

    // Contains a segment filter
    const segmentFilters: TBaseFilters = [basePerson, baseSegment];
    expect(isAdvancedSegment(segmentFilters)).toBe(true);

    // Contains a group
    const nestedGroup = createBaseFilter([baseAttr], "and", "ng1");
    const groupFilters: TBaseFilters = [basePerson, nestedGroup];
    expect(isAdvancedSegment(groupFilters)).toBe(true);

    // Empty filters
    expect(isAdvancedSegment([])).toBe(false);
  });
});
