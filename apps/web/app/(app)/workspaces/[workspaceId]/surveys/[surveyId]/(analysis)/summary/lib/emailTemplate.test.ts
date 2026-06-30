import { describe, expect, test } from "vitest";
import { extractEmailBodyFragment } from "./emailTemplateFragment";

describe("extractEmailBodyFragment", () => {
  test("returns the body contents for rendered email documents", () => {
    const html = `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html>
        <head>
          <style>.foo { color: red; }</style>
        </head>
        <body class="email-body">
          <table>
            <tr>
              <td>Preview content</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    expect(extractEmailBodyFragment(html)).toBe(
      "<table>\n            <tr>\n              <td>Preview content</td>\n            </tr>\n          </table>"
    );
  });

  test("removes document-level tags from rendered survey email markup", () => {
    const fragment = extractEmailBodyFragment(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>.foo { color: red; }</style>
        </head>
        <body>
          <table>
            <tr>
              <td>Which fruits do you like</td>
            </tr>
          </table>
        </body>
      </html>
    `);

    expect(fragment).toBe(
      "<table>\n            <tr>\n              <td>Which fruits do you like</td>\n            </tr>\n          </table>"
    );
    expect(fragment).not.toMatch(/<!DOCTYPE|<html|<head|<body/i);
  });

  test("falls back to the original markup when no body tag exists", () => {
    expect(extractEmailBodyFragment("<div>Preview content</div>")).toBe("<div>Preview content</div>");
  });

  test("removes React server markers from rendered fragments", () => {
    expect(extractEmailBodyFragment("<body><!--$--><div>Preview content</div><!--/$--></body>")).toBe(
      "<div>Preview content</div>"
    );
  });
});
