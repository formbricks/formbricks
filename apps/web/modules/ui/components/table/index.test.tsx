import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./index";

describe("Table", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders table correctly", () => {
    render(<Table data-testid="test-table" />);

    const table = screen.getByTestId("test-table");
    expect(table).toBeInTheDocument();
    expect(table.tagName).toBe("TABLE");
    expect(table).toHaveClass("w-full");
    expect(table).toHaveClass("caption-bottom");
    expect(table).toHaveClass("text-sm");
  });

  test("applies custom className to Table", () => {
    render(<Table className="custom-class" data-testid="test-table" />);

    const table = screen.getByTestId("test-table");
    expect(table).toHaveClass("custom-class");
    expect(table).toHaveClass("w-full");
  });

  test("renders TableHeader correctly", () => {
    render(
      <Table>
        <TableHeader data-testid="test-header">
          <TableRow>
            <TableHead>Header</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );

    const header = screen.getByTestId("test-header");
    expect(header).toBeInTheDocument();
    expect(header.tagName).toBe("THEAD");
    expect(header).toHaveClass("pointer-events-none");
    expect(header).toHaveClass("text-slate-800");
  });

  test("renders TableBody correctly", () => {
    render(
      <Table>
        <TableBody data-testid="test-body">
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const body = screen.getByTestId("test-body");
    expect(body).toBeInTheDocument();
    expect(body.tagName).toBe("TBODY");
  });

  test("renders TableFooter correctly", () => {
    render(
      <Table>
        <TableFooter data-testid="test-footer">
          <TableRow>
            <TableCell>Footer</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );

    const footer = screen.getByTestId("test-footer");
    expect(footer).toBeInTheDocument();
    expect(footer.tagName).toBe("TFOOT");
    expect(footer).toHaveClass("border-t");
  });

  test("renders TableRow correctly", () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-testid="test-row">
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const row = screen.getByTestId("test-row");
    expect(row).toBeInTheDocument();
    expect(row.tagName).toBe("TR");
    expect(row).toHaveClass("border-b");
    expect(row).toHaveClass("bg-white");
    expect(row).toHaveClass("hover:bg-slate-100");
  });

  test("renders TableHead correctly", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead data-testid="test-head">Header</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );

    const head = screen.getByTestId("test-head");
    expect(head).toBeInTheDocument();
    expect(head.tagName).toBe("TH");
    expect(head).toHaveClass("h-12");
    expect(head).toHaveClass("px-4");
    expect(head).toHaveClass("text-left");
    expect(head).toHaveClass("align-middle");
  });

  test("renders TableCell correctly", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell data-testid="test-cell">Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    const cell = screen.getByTestId("test-cell");
    expect(cell).toBeInTheDocument();
    expect(cell.tagName).toBe("TD");
    expect(cell).toHaveClass("p-4");
    expect(cell).toHaveClass("align-middle");
  });

  test("renders TableCaption correctly", () => {
    render(
      <Table>
        <TableCaption data-testid="test-caption">Caption</TableCaption>
      </Table>
    );

    const caption = screen.getByTestId("test-caption");
    expect(caption).toBeInTheDocument();
    expect(caption.tagName).toBe("CAPTION");
    expect(caption).toHaveClass("mt-4");
    expect(caption).toHaveClass("text-sm");
    expect(caption.textContent).toBe("Caption");
  });

  test("renders full table structure correctly", () => {
    render(
      <Table data-testid="full-table">
        <TableCaption>A list of users</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>John Doe</TableCell>
            <TableCell>john@example.com</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Jane Smith</TableCell>
            <TableCell>jane@example.com</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total: 2 users</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );

    const table = screen.getByTestId("full-table");
    expect(table).toBeInTheDocument();

    expect(screen.getByText("A list of users")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("Total: 2 users")).toBeInTheDocument();
  });
});
