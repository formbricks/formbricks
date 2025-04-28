import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
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

  test("renders TiredFace", () => {
    checkSvg(TiredFace);
  });
  test("renders WearyFace", () => {
    checkSvg(WearyFace);
  });
  test("renders PerseveringFace", () => {
    checkSvg(PerseveringFace);
  });
  test("renders FrowningFace", () => {
    checkSvg(FrowningFace);
  });
  test("renders ConfusedFace", () => {
    checkSvg(ConfusedFace);
  });
  test("renders NeutralFace", () => {
    checkSvg(NeutralFace);
  });
  test("renders SlightlySmilingFace", () => {
    checkSvg(SlightlySmilingFace);
  });
  test("renders SmilingFaceWithSmilingEyes", () => {
    checkSvg(SmilingFaceWithSmilingEyes);
  });
  test("renders GrinningFaceWithSmilingEyes", () => {
    checkSvg(GrinningFaceWithSmilingEyes);
  });
  test("renders GrinningSquintingFace", () => {
    checkSvg(GrinningSquintingFace);
  });
});
