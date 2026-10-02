import { describe, expect, test } from "vitest";
import { ZodError } from "zod";
import { parseListWorkflowsQuery } from "./parse-list-query";

const workspaceId = "cm9zr4mps000008l8btfy1vtz";

const parse = (query: string) => parseListWorkflowsQuery(new URLSearchParams(query));

describe("parseListWorkflowsQuery", () => {
  test("passes the name filter through", () => {
    expect(parse(`workspaceId=${workspaceId}&filter[name][contains]=Alpha`).nameContains).toBe("Alpha");
  });

  /** Postgres `text` cannot hold U+0000; let through, it fails the query and answers 500 (ENG-3550). */
  test("rejects a NULL byte in the name filter with a ZodError the handler maps to a 400", () => {
    let thrown: unknown;
    try {
      parse(`workspaceId=${workspaceId}&filter[name][contains]=a%00b`);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ZodError);
    expect((thrown as ZodError).issues).toMatchObject([
      { path: ["nameContains"], message: "must not contain NULL bytes" },
    ]);
  });
});
