import { render } from "@testing-library/preact";
import { describe, expect, test } from "vitest";
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
} from "./smileys";

describe("Smiley Components", () => {
  const testProps = {
    className: "test-class",
    "data-testid": "smiley-icon",
  };

  const components = [
    { name: "TiredFace", Component: TiredFace },
    { name: "WearyFace", Component: WearyFace },
    { name: "PerseveringFace", Component: PerseveringFace },
    { name: "FrowningFace", Component: FrowningFace },
    { name: "ConfusedFace", Component: ConfusedFace },
    { name: "NeutralFace", Component: NeutralFace },
    { name: "SlightlySmilingFace", Component: SlightlySmilingFace },
    { name: "SmilingFaceWithSmilingEyes", Component: SmilingFaceWithSmilingEyes },
    { name: "GrinningFaceWithSmilingEyes", Component: GrinningFaceWithSmilingEyes },
    { name: "GrinningSquintingFace", Component: GrinningSquintingFace },
  ];

  components.forEach(({ name, Component }) => {
    describe(name, () => {
      test("renders with default props", () => {
        const { container } = render(<Component />);
        const svg = container.querySelector("svg");
        expect(svg).to.exist;
        expect(svg?.getAttribute("viewBox")).to.equal("0 0 72 72");
        expect(svg?.getAttribute("xmlns")).to.equal("http://www.w3.org/2000/svg");

        // Check for base circle
        const circle = container.querySelector("circle");
        expect(circle).to.exist;
        expect(circle?.getAttribute("cx")).to.equal("36");
        expect(circle?.getAttribute("cy")).to.equal("36");
        expect(circle?.getAttribute("r")).to.equal("23");

        // Check for path elements
        const paths = container.querySelectorAll("path, line, polyline");
        expect(paths.length).to.be.greaterThan(0);
      });

      test("applies custom props correctly", () => {
        const { container } = render(
          <Component {...testProps} style={{ stroke: "red", strokeWidth: 3, fill: "blue" }} />
        );
        const circle = container.querySelector("[data-testid='smiley-icon']");
        expect(circle).to.exist;
        expect(circle?.classList.contains("test-class")).to.be.true;
        expect(circle?.getAttribute("style")).to.include("stroke: red");
        expect(circle?.getAttribute("style")).to.include("stroke-width: 3");
        expect(circle?.getAttribute("style")).to.include("fill: blue");
      });

      test("maintains accessibility", () => {
        const { container } = render(<Component aria-label={`${name} emoji`} data-testid="smiley-svg" />);
        const svg = container.querySelector("[data-testid='smiley-svg']");
        expect(svg).to.exist;
        expect(svg?.getAttribute("aria-label")).to.equal(`${name} emoji`);
      });
    });
  });
});
