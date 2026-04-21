import { describe, expect, test } from "vitest";
import { extractEmailBodyFragment } from "./emailTemplate";

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

    expect(extractEmailBodyFragment(html)).toBe("<table>\n            <tr>\n              <td>Preview content</td>\n            </tr>\n          </table>");
  });

  test("falls back to the original markup when no body tag exists", () => {
    expect(extractEmailBodyFragment("<div>Preview content</div>")).toBe("<div>Preview content</div>");
  });
});
