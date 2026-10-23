import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const LAYER = "@radix-ui/react-dismissable-layer";

// Resolves `specifier` the way Node does from inside the package at `fromFile`.
const resolveFrom = (fromFile: string, specifier: string) => createRequire(fromFile).resolve(specifier);

const app = import.meta.filename;

/**
 * Each Radix component that renders a dismissable layer, as the app reaches it: `react-menu` comes in
 * through `react-dropdown-menu`.
 */
const layerConsumers: Record<string, () => string> = {
  "@radix-ui/react-dialog": () => resolveFrom(app, "@radix-ui/react-dialog"),
  "@radix-ui/react-popover": () => resolveFrom(app, "@radix-ui/react-popover"),
  "@radix-ui/react-select": () => resolveFrom(app, "@radix-ui/react-select"),
  "@radix-ui/react-tooltip": () => resolveFrom(app, "@radix-ui/react-tooltip"),
  "@radix-ui/react-menu (via react-dropdown-menu)": () =>
    resolveFrom(resolveFrom(app, "@radix-ui/react-dropdown-menu"), "@radix-ui/react-menu"),
};

// `ServerActionNotices` is a dismissable-layer `Branch`, so a click on a notice does not dismiss an open
// dialog, popover or menu. A Branch registers in the module-level context of the copy it is imported
// from, so it only works while every Radix component resolves the same copy. A Radix bump that pulls in
// a second version would bring back "closing the notice closes the dialog and loses what was typed"
// without anything else failing (ENG-2899).
describe("dismissable-layer copy shared with the Radix components", () => {
  const ours = resolveFrom(app, LAYER);

  test.each(Object.entries(layerConsumers))(
    "%s resolves the copy ServerActionNotices imports",
    (_, resolve) => {
      expect(resolveFrom(resolve(), LAYER)).toBe(ours);
    }
  );
});
