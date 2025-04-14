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

const checkSvg = (Component: React.FC<React.SVGProps<SVGElement>>) => {
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
    checkSvg(TiredFace);
  });
  it("renders WearyFace", () => {
    checkSvg(WearyFace);
  });
  it("renders PerseveringFace", () => {
    checkSvg(PerseveringFace);
  });
  it("renders FrowningFace", () => {
    checkSvg(FrowningFace);
  });
  it("renders ConfusedFace", () => {
    checkSvg(ConfusedFace);
  });
  it("renders NeutralFace", () => {
    checkSvg(NeutralFace);
  });
  it("renders SlightlySmilingFace", () => {
    checkSvg(SlightlySmilingFace);
  });
  it("renders SmilingFaceWithSmilingEyes", () => {
    checkSvg(SmilingFaceWithSmilingEyes);
  });
  it("renders GrinningFaceWithSmilingEyes", () => {
    checkSvg(GrinningFaceWithSmilingEyes);
  });
  it("renders GrinningSquintingFace", () => {
    checkSvg(GrinningSquintingFace);
  });
});
