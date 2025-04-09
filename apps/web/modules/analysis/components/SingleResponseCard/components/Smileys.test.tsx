import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConfusedFace,
  FrowningFace,
  GrinningFaceWithSmilingEyes,
  GrinningSquintingFace,
  NeutralFace,
  PerseveringFace,
  SlightlySmilingFace,
  SmilingFaceWithSmilingEyes,
  TiredFace,
  WearyFace,
} from "./Smileys";

const checkSvg = (componentName: string, Component: React.FC<React.SVGProps<SVGElement>>) => {
  const { container } = render(<Component />);
  const svg = container.querySelector("svg");
  expect(svg).toBeTruthy();
  expect(svg).toHaveAttribute("viewBox", "0 0 72 72");
  expect(svg).toHaveAttribute("width", "36");
  expect(svg).toHaveAttribute("height", "36");
};

describe("Smileys", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders TiredFace", () => {
    checkSvg("TiredFace", TiredFace);
  });
  it("renders WearyFace", () => {
    checkSvg("WearyFace", WearyFace);
  });
  it("renders PerseveringFace", () => {
    checkSvg("PerseveringFace", PerseveringFace);
  });
  it("renders FrowningFace", () => {
    checkSvg("FrowningFace", FrowningFace);
  });
  it("renders ConfusedFace", () => {
    checkSvg("ConfusedFace", ConfusedFace);
  });
  it("renders NeutralFace", () => {
    checkSvg("NeutralFace", NeutralFace);
  });
  it("renders SlightlySmilingFace", () => {
    checkSvg("SlightlySmilingFace", SlightlySmilingFace);
  });
  it("renders SmilingFaceWithSmilingEyes", () => {
    checkSvg("SmilingFaceWithSmilingEyes", SmilingFaceWithSmilingEyes);
  });
  it("renders GrinningFaceWithSmilingEyes", () => {
    checkSvg("GrinningFaceWithSmilingEyes", GrinningFaceWithSmilingEyes);
  });
  it("renders GrinningSquintingFace", () => {
    checkSvg("GrinningSquintingFace", GrinningSquintingFace);
  });
});
