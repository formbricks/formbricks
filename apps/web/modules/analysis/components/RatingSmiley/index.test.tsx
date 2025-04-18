import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RatingSmiley } from "./index";

// Mock the smiley components from ../SingleResponseCard/components/Smileys
vi.mock("../SingleResponseCard/components/Smileys", () => ({
  TiredFace: (props: any) => (
    <span data-testid="TiredFace" className={props.className}>
      TiredFace
    </span>
  ),
  WearyFace: (props: any) => (
    <span data-testid="WearyFace" className={props.className}>
      WearyFace
    </span>
  ),
  PerseveringFace: (props: any) => (
    <span data-testid="PerseveringFace" className={props.className}>
      PerseveringFace
    </span>
  ),
  FrowningFace: (props: any) => (
    <span data-testid="FrowningFace" className={props.className}>
      FrowningFace
    </span>
  ),
  ConfusedFace: (props: any) => (
    <span data-testid="ConfusedFace" className={props.className}>
      ConfusedFace
    </span>
  ),
  NeutralFace: (props: any) => (
    <span data-testid="NeutralFace" className={props.className}>
      NeutralFace
    </span>
  ),
  SlightlySmilingFace: (props: any) => (
    <span data-testid="SlightlySmilingFace" className={props.className}>
      SlightlySmilingFace
    </span>
  ),
  SmilingFaceWithSmilingEyes: (props: any) => (
    <span data-testid="SmilingFaceWithSmilingEyes" className={props.className}>
      SmilingFaceWithSmilingEyes
    </span>
  ),
  GrinningFaceWithSmilingEyes: (props: any) => (
    <span data-testid="GrinningFaceWithSmilingEyes" className={props.className}>
      GrinningFaceWithSmilingEyes
    </span>
  ),
  GrinningSquintingFace: (props: any) => (
    <span data-testid="GrinningSquintingFace" className={props.className}>
      GrinningSquintingFace
    </span>
  ),
}));

describe("RatingSmiley", () => {
  afterEach(() => {
    cleanup();
  });

  const activeClass = "fill-rating-fill";

  // Test branch: range === 10 => iconsIdx = [0,1,2,...,9]
  test("renders correct icon for range 10 when active", () => {
    // For idx 0, iconsIdx[0] === 0, which corresponds to TiredFace.
    const { getByTestId } = render(<RatingSmiley active={true} idx={0} range={10} addColors={true} />);
    const icon = getByTestId("TiredFace");
    expect(icon).toBeDefined();
    expect(icon.className).toContain(activeClass);
  });

  test("renders correct icon for range 10 when inactive", () => {
    const { getByTestId } = render(<RatingSmiley active={false} idx={0} range={10} />);
    const icon = getByTestId("TiredFace");
    expect(icon).toBeDefined();
    expect(icon.className).toContain("fill-none");
  });

  // Test branch: range === 7 => iconsIdx = [1,3,4,5,6,8,9]
  test("renders correct icon for range 7 when active", () => {
    // For idx 0, iconsIdx[0] === 1, which corresponds to WearyFace.
    const { getByTestId } = render(<RatingSmiley active={true} idx={0} range={7} addColors={true} />);
    const icon = getByTestId("WearyFace");
    expect(icon).toBeDefined();
    expect(icon.className).toContain(activeClass);
  });

  // Test branch: range === 5 => iconsIdx = [3,4,5,6,7]
  test("renders correct icon for range 5 when active", () => {
    // For idx 0, iconsIdx[0] === 3, which corresponds to FrowningFace.
    const { getByTestId } = render(<RatingSmiley active={true} idx={0} range={5} addColors={true} />);
    const icon = getByTestId("FrowningFace");
    expect(icon).toBeDefined();
    expect(icon.className).toContain(activeClass);
  });

  // Test branch: range === 4 => iconsIdx = [4,5,6,7]
  test("renders correct icon for range 4 when active", () => {
    // For idx 0, iconsIdx[0] === 4, corresponding to ConfusedFace.
    const { getByTestId } = render(<RatingSmiley active={true} idx={0} range={4} addColors={true} />);
    const icon = getByTestId("ConfusedFace");
    expect(icon).toBeDefined();
    expect(icon.className).toContain(activeClass);
  });

  // Test branch: range === 3 => iconsIdx = [4,5,7]
  test("renders correct icon for range 3 when active", () => {
    // For idx 0, iconsIdx[0] === 4, corresponding to ConfusedFace.
    const { getByTestId } = render(<RatingSmiley active={true} idx={0} range={3} addColors={true} />);
    const icon = getByTestId("ConfusedFace");
    expect(icon).toBeDefined();
    expect(icon.className).toContain(activeClass);
  });
});
