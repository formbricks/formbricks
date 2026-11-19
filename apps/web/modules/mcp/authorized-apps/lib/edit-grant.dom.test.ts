/**
 * @vitest-environment jsdom
 */
import { describe, expect, test } from "vitest";
import { isEscapeForOpenPicker } from "./edit-grant";

const render = (html: string): HTMLElement => {
  document.body.innerHTML = html;
  return document.body;
};

// Smoke E: Escape in the workspace picker closed the whole Edit dialog and threw the changes away.
describe("isEscapeForOpenPicker", () => {
  test("is true for the input of a picker, which is open while it has focus", () => {
    const body = render('<div cmdk-root=""><div><input id="picker" /></div></div>');
    expect(isEscapeForOpenPicker(body.querySelector("#picker"))).toBe(true);
  });

  test("is false anywhere else in the dialog, so Escape still closes it", () => {
    const body = render(
      '<div role="dialog"><button id="save">Save</button><input id="other" /><div cmdk-root=""><button id="remove">x</button></div></div>'
    );
    expect(isEscapeForOpenPicker(body.querySelector("#save"))).toBe(false);
    expect(isEscapeForOpenPicker(body.querySelector("#other"))).toBe(false);
    expect(isEscapeForOpenPicker(body.querySelector("#remove"))).toBe(false);
    expect(isEscapeForOpenPicker(null)).toBe(false);
  });
});
