import { cleanup, render } from "@testing-library/react";
import { Code2Icon, MousePointerClickIcon } from "lucide-react";
import React from "react";
import { afterEach, describe, expect, test } from "vitest";
import { ACTION_TYPE_ICON_LOOKUP } from "./utils";

describe("ACTION_TYPE_ICON_LOOKUP", () => {
  afterEach(() => {
    cleanup();
  });

  test("should contain the correct icon for 'code'", () => {
    expect(ACTION_TYPE_ICON_LOOKUP).toHaveProperty("code");
    const IconComponent = ACTION_TYPE_ICON_LOOKUP.code;
    expect(React.isValidElement(IconComponent)).toBe(true);

    // Render the icon and check if it's the correct Lucide icon
    const { container } = render(IconComponent);
    const svgElement = container.querySelector("svg");
    expect(svgElement).toBeInTheDocument();
    // Check for a class or attribute specific to Code2Icon if possible,
    // or compare the rendered output structure if necessary.
    // For simplicity, we check the component type directly (though this is less robust)
    expect(IconComponent.type).toBe(Code2Icon);
  });

  test("should contain the correct icon for 'noCode'", () => {
    expect(ACTION_TYPE_ICON_LOOKUP).toHaveProperty("noCode");
    const IconComponent = ACTION_TYPE_ICON_LOOKUP.noCode;
    expect(React.isValidElement(IconComponent)).toBe(true);

    // Render the icon and check if it's the correct Lucide icon
    const { container } = render(IconComponent);
    const svgElement = container.querySelector("svg");
    expect(svgElement).toBeInTheDocument();
    // Similar check as above for MousePointerClickIcon
    expect(IconComponent.type).toBe(MousePointerClickIcon);
  });
});
