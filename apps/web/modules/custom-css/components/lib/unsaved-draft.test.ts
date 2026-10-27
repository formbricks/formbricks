import { describe, expect, test } from "vitest";
import { getUnsavedWorkspaceCssDraft, keepUnsavedWorkspaceCssDraft } from "./unsaved-draft";

const saved = { light: ".a { color: red }", dark: null };
const edited = { light: ".a { color: blue }", dark: "" };

describe("unsaved workspace CSS drafts", () => {
  test("a draft that differs from the saved CSS is offered back while that CSS is still saved", () => {
    keepUnsavedWorkspaceCssDraft("ws_kept", saved, edited);

    expect(getUnsavedWorkspaceCssDraft("ws_kept", saved)).toEqual(edited);
    // Still there on the next visit: reading it does not use it up.
    expect(getUnsavedWorkspaceCssDraft("ws_kept", { light: ".a { color: red }", dark: "  " })).toEqual(
      edited
    );
    expect(getUnsavedWorkspaceCssDraft("ws_other", saved)).toBeNull();
  });

  test("a draft equal to the saved CSS, or none at all, is not kept", () => {
    keepUnsavedWorkspaceCssDraft("ws_same", saved, edited);
    keepUnsavedWorkspaceCssDraft("ws_same", saved, { light: ".a { color: red }", dark: " " });
    expect(getUnsavedWorkspaceCssDraft("ws_same", saved)).toBeNull();

    keepUnsavedWorkspaceCssDraft("ws_reset", saved, edited);
    keepUnsavedWorkspaceCssDraft("ws_reset", saved, null);
    expect(getUnsavedWorkspaceCssDraft("ws_reset", saved)).toBeNull();
  });

  test("clearing all CSS is an unsaved change worth keeping", () => {
    keepUnsavedWorkspaceCssDraft("ws_clear", saved, { light: "", dark: "" });
    expect(getUnsavedWorkspaceCssDraft("ws_clear", saved)).toEqual({ light: "", dark: "" });
  });

  test("once other CSS has been saved, the draft is not offered back, so it cannot undo that save", () => {
    keepUnsavedWorkspaceCssDraft("ws_stale", saved, edited);
    expect(getUnsavedWorkspaceCssDraft("ws_stale", { light: ".b {}", dark: null })).toBeNull();
  });

  test("a draft that now matches what was saved since is not offered back", () => {
    keepUnsavedWorkspaceCssDraft("ws_saved", saved, edited);
    expect(getUnsavedWorkspaceCssDraft("ws_saved", { light: ".a { color: blue }", dark: null })).toBeNull();
  });
});
