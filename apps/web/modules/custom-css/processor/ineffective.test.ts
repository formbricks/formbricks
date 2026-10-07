import { lexer } from "css-tree";
import { afterEach, describe, expect, test, vi } from "vitest";
import { findIneffectiveDeclarations } from "./ineffective";

describe("findIneffectiveDeclarations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("stops at the limit, since no more notes can be reported", () => {
    expect(findIneffectiveDeclarations(".a{colr:red}".repeat(500), 20)).toHaveLength(20);
  });

  test("relative colors and calc-size(), which browsers support ahead of the grammar, get no note", () => {
    expect(
      findIneffectiveDeclarations(
        ".a{color:rgb(from red r g b / 50%);background:OKLCH(from #123 l c h);width:calc-size(auto, size)}"
      )
    ).toEqual([]);
    expect(findIneffectiveDeclarations(".a{color:rgb(fromred)}")).toHaveLength(1);
  });

  test("a grammar check that throws keeps the notes found so far instead of failing", () => {
    const matchProperty = lexer.matchProperty.bind(lexer);
    let calls = 0;
    vi.spyOn(lexer, "matchProperty").mockImplementation((name, value) => {
      calls++;
      if (calls === 2) throw new Error("grammar check failed");
      return matchProperty(name, value);
    });

    expect(findIneffectiveDeclarations(".a{color:notacolor} .b{color:red} .c{color:alsonot}")).toEqual([
      expect.objectContaining({ code: "invalid_value", location: { line: 1, column: 4 } }),
    ]);
  });
});
