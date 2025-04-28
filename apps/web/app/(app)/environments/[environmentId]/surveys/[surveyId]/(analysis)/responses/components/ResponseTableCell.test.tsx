import type { Cell, Row } from "@tanstack/react-table";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TResponse, TResponseTableData } from "@formbricks/types/responses";
import { ResponseTableCell } from "./ResponseTableCell";

const makeCell = (
  id: string,
  size = 100,
  first = false,
  last = false,
  content = "CellContent"
): Cell<TResponseTableData, unknown> =>
  ({
    column: {
      id,
      getSize: () => size,
      getIsFirstColumn: () => first,
      getIsLastColumn: () => last,
      getStart: () => 0,
      columnDef: { cell: () => content },
    },
    id,
    getContext: () => ({}),
  }) as unknown as Cell<TResponseTableData, unknown>;

const makeRow = (id: string, selected = false): Row<TResponseTableData> =>
  ({ id, getIsSelected: () => selected }) as unknown as Row<TResponseTableData>;

describe("ResponseTableCell", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders cell content", () => {
    const cell = makeCell("col1");
    const row = makeRow("r1");
    render(
      <ResponseTableCell
        cell={cell}
        row={row}
        isExpanded={false}
        setSelectedResponseId={vi.fn()}
        responses={[]}
      />
    );
    expect(screen.getByText("CellContent")).toBeDefined();
  });

  test("calls setSelectedResponseId on cell click when not select column", async () => {
    const cell = makeCell("col1");
    const row = makeRow("r1");
    const setSel = vi.fn();
    render(
      <ResponseTableCell
        cell={cell}
        row={row}
        isExpanded={false}
        setSelectedResponseId={setSel}
        responses={[{ id: "r1" } as TResponse]}
      />
    );
    await userEvent.click(screen.getByText("CellContent"));
    expect(setSel).toHaveBeenCalledWith("r1");
  });

  test("does not call setSelectedResponseId on select column click", async () => {
    const cell = makeCell("select");
    const row = makeRow("r1");
    const setSel = vi.fn();
    render(
      <ResponseTableCell
        cell={cell}
        row={row}
        isExpanded={false}
        setSelectedResponseId={setSel}
        responses={[{ id: "r1" } as TResponse]}
      />
    );
    await userEvent.click(screen.getByText("CellContent"));
    expect(setSel).not.toHaveBeenCalled();
  });

  test("renders maximize icon for createdAt column and handles click", async () => {
    const cell = makeCell("createdAt", 120, false, false);
    const row = makeRow("r2");
    const setSel = vi.fn();
    render(
      <ResponseTableCell
        cell={cell}
        row={row}
        isExpanded={false}
        setSelectedResponseId={setSel}
        responses={[{ id: "r2" } as TResponse]}
      />
    );
    const btn = screen.getByRole("button", { name: /expand response/i });
    expect(btn).toBeDefined();
    await userEvent.click(btn);
    expect(setSel).toHaveBeenCalledWith("r2");
  });

  test("does not apply selected style when row.getIsSelected() is false", () => {
    const cell = makeCell("col1");
    const row = makeRow("r1", false);
    const { container } = render(
      <ResponseTableCell
        cell={cell}
        row={row}
        isExpanded={false}
        setSelectedResponseId={vi.fn()}
        responses={[]}
      />
    );
    expect(container.firstChild).not.toHaveClass("bg-slate-100");
  });

  test("applies selected style when row.getIsSelected() is true", () => {
    const cell = makeCell("col1");
    const row = makeRow("r1", true);
    const { container } = render(
      <ResponseTableCell
        cell={cell}
        row={row}
        isExpanded={false}
        setSelectedResponseId={vi.fn()}
        responses={[]}
      />
    );
    expect(container.firstChild).toHaveClass("bg-slate-100");
  });

  test("renders collapsed height class when isExpanded is false", () => {
    const cell = makeCell("col1");
    const row = makeRow("r1");
    const { container } = render(
      <ResponseTableCell
        cell={cell}
        row={row}
        isExpanded={false}
        setSelectedResponseId={vi.fn()}
        responses={[]}
      />
    );
    const inner = container.querySelector("div > div");
    expect(inner).toHaveClass("h-10");
  });

  test("renders expanded height class when isExpanded is true", () => {
    const cell = makeCell("col1");
    const row = makeRow("r1");
    const { container } = render(
      <ResponseTableCell
        cell={cell}
        row={row}
        isExpanded={true}
        setSelectedResponseId={vi.fn()}
        responses={[]}
      />
    );
    const inner = container.querySelector("div > div");
    expect(inner).toHaveClass("h-full");
  });
});
