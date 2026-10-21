import { describe, expect, test } from "vitest";
import type { TShowConditionGroup, TShowConditionSingle } from "@formbricks/types/show-conditions";
import { ZShowConditions } from "@formbricks/types/show-conditions";
import {
  addShowConditionBelow,
  appendShowCondition,
  canCreateShowConditionGroup,
  createShowCondition,
  createShowConditionGroup,
  duplicateShowCondition,
  listShowConditions,
  removeShowCondition,
  toggleShowConditionConnector,
  updateShowCondition,
} from "./tree";

const condition = (id: string, overrides: Partial<TShowConditionSingle> = {}): TShowConditionSingle => ({
  id,
  leftOperand: { type: "page", value: "currentUrl" },
  operator: "containsAnyOf",
  rightOperand: { type: "static", value: ["/plans"] },
  ...overrides,
});

const root = (conditions: TShowConditionGroup["conditions"], connector: "and" | "or" = "and") => ({
  id: "root",
  connector,
  conditions,
});

const ids = (group: TShowConditionGroup | null) => listShowConditions(group).map((item) => item.id);

describe("show-conditions tree", () => {
  test("starts a tree with one condition, and appends to an existing one", () => {
    const started = appendShowCondition(null);
    expect(started.conditions).toHaveLength(1);

    expect(appendShowCondition(root([condition("a")])).conditions).toHaveLength(2);
  });

  test("a new condition on each operand starts with a comparison that operand allows", () => {
    expect(createShowCondition("pagesViewed")).toMatchObject({
      leftOperand: { type: "visit", value: "pagesViewed" },
      operator: "isGreaterThanOrEqual",
    });
    expect(createShowCondition("queryParam")).toMatchObject({
      leftOperand: { type: "page", value: "queryParam", meta: { key: "" } },
      operator: "equals",
    });
    expect(createShowCondition("deviceType").leftOperand.type).toBe("device");
  });

  // Product, 19 Oct: a new URL condition is an exact list of paths, not "contains", so a line like
  // /blog/planning cannot quietly cover /blog/planning-for-retirement.
  test("a new Current URL condition starts as an exact path list", () => {
    expect(createShowCondition("currentUrl").operator).toBe("pathIsAnyOf");
    expect(createShowCondition().operator).toBe("pathIsAnyOf");
  });

  test("adds a condition below the one it was asked for, inside a group too", () => {
    const tree = root([condition("a"), { id: "g", connector: "or", conditions: [condition("b")] }]);

    expect(ids(addShowConditionBelow(tree, "a"))[0]).toBe("a");
    expect(addShowConditionBelow(tree, "a").conditions).toHaveLength(3);

    const insideGroup = addShowConditionBelow(tree, "b").conditions[1] as TShowConditionGroup;
    expect(insideGroup.conditions).toHaveLength(2);
    expect(insideGroup.conditions[0].id).toBe("b");
  });

  test("duplicates with fresh ids, so the copy can be edited on its own", () => {
    const duplicated = duplicateShowCondition(root([condition("a")]), "a");
    const [original, copy] = duplicated.conditions as TShowConditionSingle[];

    expect(copy.id).not.toBe(original.id);
    expect(copy.rightOperand).toEqual(original.rightOperand);
    expect(copy.rightOperand).not.toBe(original.rightOperand);
  });

  test("removing the last condition leaves no conditions at all", () => {
    expect(removeShowCondition(root([condition("a")]), "a")).toBeNull();
  });

  test("removing drops a group left empty, and a lone group takes the top level's place", () => {
    const tree = root([
      condition("a"),
      { id: "g", connector: "or", conditions: [condition("b"), condition("c")] },
    ]);

    const withoutA = removeShowCondition(tree, "a");
    expect(withoutA).toMatchObject({ id: "root", connector: "or" });
    expect(ids(withoutA)).toEqual(["b", "c"]);

    const withoutGroupContents = removeShowCondition(removeShowCondition(tree, "b")!, "c");
    expect(ids(withoutGroupContents)).toEqual(["a"]);
  });

  test("groups only at the top level, which is all the schema allows", () => {
    expect(canCreateShowConditionGroup(0)).toBe(true);
    expect(canCreateShowConditionGroup(1)).toBe(false);

    const grouped = createShowConditionGroup(root([condition("a"), condition("b")]), "b");
    expect(grouped.conditions[1]).toMatchObject({ connector: "and", conditions: [{ id: "b" }] });
    expect(ZShowConditions.safeParse(grouped).success).toBe(true);
  });

  test("toggles the connector of the group asked for and no other", () => {
    const tree = root([condition("a"), { id: "g", connector: "or", conditions: [condition("b")] }]);
    const toggled = toggleShowConditionConnector(tree, "g");

    expect(toggled.connector).toBe("and");
    expect((toggled.conditions[1] as TShowConditionGroup).connector).toBe("and");
  });

  test("changing the operand resets the comparison and value to ones the new operand accepts", () => {
    const updated = updateShowCondition(root([condition("a")]), "a", {
      leftOperand: { value: "timeOnSite", type: "visit", meta: { type: "visit" } },
      operator: "equals",
      rightOperand: undefined,
    });

    expect(updated.conditions[0]).toEqual({
      id: "a",
      leftOperand: { type: "visit", value: "timeOnSite" },
      operator: "isGreaterThanOrEqual",
    });
  });

  test("keeps an operator only if the operand allows it", () => {
    const tree = root([
      condition("a", { leftOperand: { type: "visit", value: "pagesViewed" }, operator: "equals" }),
    ]);

    expect(updateShowCondition(tree, "a", { operator: "contains" }).conditions[0]).toMatchObject({
      operator: "equals",
    });
    expect(updateShowCondition(tree, "a", { operator: "isLessThan" }).conditions[0]).toMatchObject({
      operator: "isLessThan",
    });
  });

  test("stores the query parameter's name, and clears a value that was removed", () => {
    const tree = root([{ ...createShowCondition("queryParam"), id: "a" }]);
    const named = updateShowCondition(tree, "a", {
      leftOperand: { value: "queryParam", meta: { key: "source" } },
    });
    expect((named.conditions[0] as TShowConditionSingle).leftOperand.meta).toEqual({ key: "source" });

    const valued = updateShowCondition(named, "a", { rightOperand: { value: "email", type: "static" } });
    const cleared = updateShowCondition(valued, "a", { rightOperand: undefined });
    expect(cleared.conditions[0]).not.toHaveProperty("rightOperand");
  });
});
