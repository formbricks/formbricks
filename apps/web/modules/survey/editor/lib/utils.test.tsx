import { MAX_STRING_LENGTH, extractParts, formatTextWithSlashes } from "@/modules/survey/editor/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

describe("utils.tsx", () => {
  describe("extractParts", () => {
    test("should handle plain text without delimiters", () => {
      const input = "How satisfied are you with the product?";
      const expected = ["How satisfied are you with the product?"];
      expect(extractParts(input)).toEqual(expected);
    });

    test("should extract single highlighted part between / and \\", () => {
      const input =
        "Overall product feedback? /How easy is it to use the interface?\\ /Share your thoughts\\";
      const expected = [
        "Overall product feedback? ",
        "How easy is it to use the interface?",
        " ",
        "Share your thoughts",
      ];
      expect(extractParts(input)).toEqual(expected);
    });

    test("should handle multiple highlighted parts", () => {
      const input =
        "Rate our product /How likely are you to recommend it?\\  / Any issues faced? \\ /What features do you like?\\ Final comments";
      const expected = [
        "Rate our product ",
        "How likely are you to recommend it?",
        "  ",
        " Any issues faced? ",
        " ",
        "What features do you like?",
        " Final comments",
      ];
      expect(extractParts(input)).toEqual(expected);
    });

    test("should handle unmatched opening delimiter", () => {
      const input = "Customer support experience /How responsive was our team?";
      const expected = ["Customer support experience /How responsive was our team?"];
      expect(extractParts(input)).toEqual(expected);
    });

    test("should handle empty string", () => {
      const input = "";
      const expected = [""];
      expect(extractParts(input)).toEqual(expected);
    });

    test("should handle text longer than MAX_STRING_LENGTH", () => {
      const longText = "a".repeat(MAX_STRING_LENGTH + 1); // Exceeds MAX_STRING_LENGTH
      const expected = [longText];
      expect(extractParts(longText)).toEqual(expected);
    });

    test("should handle only delimiters", () => {
      const input = "/\\";
      const expected = [""];
      expect(extractParts(input)).toEqual(expected);
    });
  });

  describe("formatTextWithSlashes", () => {
    afterEach(() => {
      cleanup();
    });

    test("should handle plain text without delimiters", () => {
      const input = "How satisfied are you with the product?";
      const result = formatTextWithSlashes(input);
      expect(result).toEqual(["How satisfied are you with the product?"]);
    });

    test("should format space separated highlighted parts (i.e. parts between / and \\)", () => {
      const input =
        "Overall product feedback? /How easy is it to use the interface?\\  /Share your thoughts\\";
      const result = formatTextWithSlashes(input);

      expect(result).toHaveLength(4);

      expect(result[0]).toBe("Overall product feedback? ");

      render(<div>{result[1]}</div>);
      expect(screen.getByText("How easy is it to use the interface?")).toBeInTheDocument();
      expect(screen.getByText("How easy is it to use the interface?")).toHaveAttribute(
        "class",
        "mx-1 rounded-md bg-slate-100 p-1 px-2 text-xs"
      );

      expect(result[2]).toBe("  ");

      render(<div>{result[3]}</div>);
      expect(screen.getByText("Share your thoughts")).toBeInTheDocument();
      expect(screen.getByText("Share your thoughts")).toHaveAttribute(
        "class",
        "mx-1 rounded-md bg-slate-100 p-1 px-2 text-xs"
      );
    });

    test("should format space separated highlighted parts (i.e. parts between / and \\) with prefix and custom class", () => {
      const input =
        "Overall product feedback? /How easy is it to use the interface?\\  /Share your thoughts\\";
      const result = formatTextWithSlashes(input, "@", ["text-sm", "font-bold"]);

      expect(result).toHaveLength(4);

      expect(result[0]).toBe("Overall product feedback? ");

      render(<div>{result[1]}</div>);
      expect(screen.getByText("@How easy is it to use the interface?")).toBeInTheDocument();
      expect(screen.getByText("@How easy is it to use the interface?")).toHaveAttribute(
        "class",
        "mx-1 rounded-md bg-slate-100 p-1 px-2 text-sm font-bold"
      );

      expect(result[2]).toBe("  ");

      render(<div>{result[3]}</div>);
      expect(screen.getByText("@Share your thoughts")).toBeInTheDocument();
      expect(screen.getByText("@Share your thoughts")).toHaveAttribute(
        "class",
        "mx-1 rounded-md bg-slate-100 p-1 px-2 text-sm font-bold"
      );
    });
  });
});
