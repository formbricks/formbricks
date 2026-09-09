import { describe, expect, test } from "vitest";
import { RESERVED_FIELD_CATALOG } from "@formbricks/types/embedded-data-resolver";
import { reconcileColumnOrder, seedReservedColumnVisibility } from "./column-state";
import { reservedColumnId } from "./utils";

/**
 * ENG-2540. The persisted column order used to be adopted wholesale, and the table-settings modal
 * iterates that array rather than the table's own columns — so a column id the saved order had never
 * seen got no visibility toggle and no drag handle at all, while still rendering at the far right.
 *
 * This already bit a variable or hidden field added after an author's first visit. Adding thirteen
 * reserved columns is what made it impossible to ship without fixing.
 *
 * Red on main: `reconcileColumnOrder` did not exist; the effect used the saved array verbatim.
 */
describe("reconcileColumnOrder", () => {
  test("a column the saved order has never seen is included, so the settings modal can show it", () => {
    // The bug, at its smallest.
    const saved = ["select", "createdAt", "ELEMENT_q1"];
    const defaults = ["select", "createdAt", "ELEMENT_q1", "METADATA_timezone"];

    expect(reconcileColumnOrder(saved, defaults)).toContain("METADATA_timezone");
  });

  test("an unknown id lands where it sits in the default order, not appended", () => {
    // Appending would move a column the author already sees — `Device`, whose id changes with the
    // catalog's `deviceType` spelling — to the right of `Tags`, and scatter new columns away from the
    // group they were declared with.
    const saved = ["createdAt", "ELEMENT_q1", "tags"];
    const defaults = ["createdAt", "ELEMENT_q1", "METADATA_url", "METADATA_country", "tags"];

    expect(reconcileColumnOrder(saved, defaults)).toStrictEqual([
      "createdAt",
      "ELEMENT_q1",
      "METADATA_url",
      "METADATA_country",
      "tags",
    ]);
  });

  test("the author's own arrangement survives", () => {
    // The whole point of keeping the saved order at all: someone who dragged `tags` to the front
    // must not have it silently moved back.
    const saved = ["tags", "createdAt", "ELEMENT_q1"];
    const defaults = ["createdAt", "ELEMENT_q1", "tags"];

    expect(reconcileColumnOrder(saved, defaults)).toStrictEqual(saved);
  });

  test("a saved id the table no longer has is dropped", () => {
    // A deleted question or a renamed storage key. Left in, it would sit in the settings modal
    // forever as a row that resolves to no column.
    const saved = ["createdAt", "ELEMENT_deleted", "ELEMENT_q1"];
    const defaults = ["createdAt", "ELEMENT_q1"];

    expect(reconcileColumnOrder(saved, defaults)).toStrictEqual(["createdAt", "ELEMENT_q1"]);
  });

  test("an order that needs nothing is returned unchanged", () => {
    const order = ["select", "createdAt", "ELEMENT_q1", "tags"];

    expect(reconcileColumnOrder(order, order)).toStrictEqual(order);
  });

  test("the result is a permutation of the table's real columns — never a duplicate, never a gap", () => {
    // The invariant that matters at runtime: TanStack renders one row per id, so a duplicate would
    // render a column twice and a gap would hide one with no way to bring it back.
    const saved = ["tags", "ELEMENT_gone", "createdAt"];
    const defaults = ["select", "createdAt", "ELEMENT_q1", "METADATA_url", "tags"];

    const result = reconcileColumnOrder(saved, defaults);

    expect([...result].sort()).toStrictEqual([...defaults].sort());
    expect(new Set(result).size).toBe(result.length);
  });

  test("a saved Device column choice survives, because its id never changed", () => {
    // The regression the reviewer asked for. `deviceType` is the one catalog name whose column id
    // stays at its persisted spelling; if that ever drifts, the saved id is dropped as stale here and
    // the author's order and visibility for Device go with it.
    const deviceId = reservedColumnId("deviceType");
    expect(deviceId).toBe("METADATA_device");

    const saved = ["createdAt", deviceId, "tags"];
    const defaults = ["createdAt", "METADATA_url", deviceId, "tags"];

    expect(reconcileColumnOrder(saved, defaults)).toContain(deviceId);
    // And the hidden choice is not overwritten by seeding.
    expect(seedReservedColumnVisibility({ [deviceId]: false })[deviceId]).toBe(false);
  });

  test("an empty saved order yields the defaults", () => {
    const defaults = ["createdAt", "ELEMENT_q1"];

    expect(reconcileColumnOrder([], defaults)).toStrictEqual(defaults);
  });
});

describe("seedReservedColumnVisibility", () => {
  const secondaryIds = RESERVED_FIELD_CATALOG.filter((entry) => entry.display === "secondary").map((entry) =>
    reservedColumnId(entry.name)
  );
  const primaryIds = RESERVED_FIELD_CATALOG.filter((entry) => entry.display === "primary").map((entry) =>
    reservedColumnId(entry.name)
  );

  test("hides every secondary column an author has never decided about", () => {
    // Without this they would be VISIBLE: TanStack treats an id absent from `columnVisibility` as
    // shown, so the thirteen new columns would appear on every survey's table unasked, several of
    // them empty for every response collected before ENG-1841.
    const seeded = seedReservedColumnVisibility({});

    for (const id of secondaryIds) {
      expect(seeded[id], id).toBe(false);
    }
    expect(secondaryIds.length).toBeGreaterThan(0);
  });

  test("leaves the primary columns alone, so today's table looks the same", () => {
    const seeded = seedReservedColumnVisibility({});

    for (const id of primaryIds) {
      expect(seeded, id).not.toHaveProperty(id);
    }
  });

  test("never overrides a choice the author has already made", () => {
    // Both directions: a revealed secondary column stays revealed, and a hidden primary one stays
    // hidden. Anything else would undo a preference on every page load.
    const saved = {
      [reservedColumnId("timezone")]: true,
      [reservedColumnId("url")]: false,
    };

    const seeded = seedReservedColumnVisibility(saved);

    expect(seeded[reservedColumnId("timezone")]).toBe(true);
    expect(seeded[reservedColumnId("url")]).toBe(false);
  });

  test("does not mutate the saved state it was given", () => {
    const saved = { [reservedColumnId("timezone")]: true };

    seedReservedColumnVisibility(saved);

    expect(saved).toStrictEqual({ [reservedColumnId("timezone")]: true });
  });

  test("leaves non-reserved column ids untouched", () => {
    const seeded = seedReservedColumnVisibility({ ELEMENT_q1: false, tags: true });

    expect(seeded.ELEMENT_q1).toBe(false);
    expect(seeded.tags).toBe(true);
  });
});
