/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, test, vi } from "vitest";
import { useRovingRadioGroup } from "./use-roving-radio-group";

const VALUES = ["a", "b", "c"];

/**
 * Renders the hook and registers a real <input type="radio"> per value through
 * the returned ref callbacks, so focus() and getComputedStyle() behave like in
 * the real component.
 */
const setup = ({
  values = VALUES,
  selectedValue,
  rtl = false,
}: {
  values?: string[];
  selectedValue?: string;
  rtl?: boolean;
} = {}) => {
  const onSelect = vi.fn();
  const view = renderHook(
    (props: { selectedValue: string | undefined }) =>
      useRovingRadioGroup({ values, selectedValue: props.selectedValue, onSelect }),
    { initialProps: { selectedValue } }
  );

  const inputs = new Map<string, HTMLInputElement>();
  const register = () => {
    for (const value of values) {
      let input = inputs.get(value);
      if (!input) {
        input = document.createElement("input");
        input.type = "radio";
        input.value = value;
        if (rtl) input.style.direction = "rtl";
        document.body.appendChild(input);
        inputs.set(value, input);
      }
      view.result.current.getRadioProps(value).ref(input);
    }
  };
  register();

  const keyDown = (value: string, key: string) => {
    const event = {
      key,
      currentTarget: inputs.get(value),
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLInputElement>;
    act(() => {
      view.result.current.getRadioProps(value).onKeyDown(event);
    });
    register(); // re-register after the state update, like a re-render would
    return event;
  };

  const tabIndexes = () => values.map((value) => view.result.current.getRadioProps(value).tabIndex);

  return { view, inputs, keyDown, tabIndexes, onSelect };
};

describe("useRovingRadioGroup", () => {
  test("the first option is the single Tab stop when nothing is selected", () => {
    const { tabIndexes } = setup();
    expect(tabIndexes()).toEqual([0, -1, -1]);
  });

  test("the selected option is the Tab stop", () => {
    const { tabIndexes } = setup({ selectedValue: "b" });
    expect(tabIndexes()).toEqual([-1, 0, -1]);
  });

  test("falls back to the first option when the selected value is unknown", () => {
    const { tabIndexes } = setup({ selectedValue: "nope" });
    expect(tabIndexes()).toEqual([0, -1, -1]);
  });

  test("ArrowRight/ArrowDown move focus forward without selecting, wrapping at the end", () => {
    const { inputs, keyDown, tabIndexes, onSelect } = setup();

    const event = keyDown("a", "ArrowRight");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(inputs.get("b"));
    expect(tabIndexes()).toEqual([-1, 0, -1]);

    keyDown("b", "ArrowDown");
    expect(document.activeElement).toBe(inputs.get("c"));

    keyDown("c", "ArrowRight");
    expect(document.activeElement).toBe(inputs.get("a"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("ArrowLeft/ArrowUp move focus backwards, wrapping at the start", () => {
    const { inputs, keyDown, onSelect } = setup();

    keyDown("a", "ArrowLeft");
    expect(document.activeElement).toBe(inputs.get("c"));

    keyDown("c", "ArrowUp");
    expect(document.activeElement).toBe(inputs.get("b"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("horizontal arrows are inverted in RTL", () => {
    const { inputs, keyDown } = setup({ rtl: true });

    keyDown("a", "ArrowLeft"); // visually forward in RTL
    expect(document.activeElement).toBe(inputs.get("b"));

    keyDown("b", "ArrowRight"); // visually backwards in RTL
    expect(document.activeElement).toBe(inputs.get("a"));

    keyDown("a", "ArrowDown"); // vertical arrows are direction-agnostic
    expect(document.activeElement).toBe(inputs.get("b"));
  });

  test("Home and End jump to the first and last option", () => {
    const { inputs, keyDown } = setup({ selectedValue: "b" });

    keyDown("b", "End");
    expect(document.activeElement).toBe(inputs.get("c"));

    keyDown("c", "Home");
    expect(document.activeElement).toBe(inputs.get("a"));
  });

  test("Enter selects the focused option and prevents implicit form submission", () => {
    const { keyDown, onSelect } = setup();

    const event = keyDown("b", "Enter");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  test("Space and other keys keep their native behavior", () => {
    const { keyDown, onSelect } = setup();

    const space = keyDown("a", " ");
    const tab = keyDown("a", "Tab");
    expect(space.preventDefault).not.toHaveBeenCalled();
    expect(tab.preventDefault).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("ignores keys from values that are not part of the group", () => {
    const { view, onSelect } = setup();

    const event = {
      key: "Enter",
      currentTarget: document.createElement("input"),
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLInputElement>;
    act(() => {
      view.result.current.getRadioProps("ghost").onKeyDown(event);
    });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("focusing an option makes it the roving Tab stop", () => {
    const { view, tabIndexes } = setup();

    act(() => {
      view.result.current.getRadioProps("c").onFocus();
    });
    expect(tabIndexes()).toEqual([-1, -1, 0]);
  });

  test("leaving the group resets the Tab stop to the selected option", () => {
    const { view, inputs, keyDown, tabIndexes } = setup({ selectedValue: "a" });

    keyDown("a", "ArrowRight");
    expect(tabIndexes()).toEqual([-1, 0, -1]);

    // Blur towards an element outside the group.
    act(() => {
      view.result.current.getRadioProps("b").onBlur({
        relatedTarget: document.body,
      } as unknown as React.FocusEvent<HTMLInputElement>);
    });
    expect(tabIndexes()).toEqual([0, -1, -1]);

    // Blur towards another radio of the group keeps the roving position.
    keyDown("a", "ArrowRight");
    act(() => {
      view.result.current.getRadioProps("b").onBlur({
        relatedTarget: inputs.get("c"),
      } as unknown as React.FocusEvent<HTMLInputElement>);
    });
    expect(tabIndexes()).toEqual([-1, 0, -1]);
  });

  test("unregistering an input removes it from the focus targets", () => {
    const { view, inputs, keyDown } = setup();

    act(() => {
      view.result.current.getRadioProps("b").ref(null);
    });
    keyDown("a", "ArrowRight");
    // The ref is gone, so nothing was focused, but the Tab stop still moved.
    expect(document.activeElement).not.toBe(inputs.get("b"));
    expect(view.result.current.getRadioProps("b").tabIndex).toBe(0);
  });
});
