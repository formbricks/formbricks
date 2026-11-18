import { jsPlugins } from "./compose.mjs";

/*
 * Static half of the strict-CSP guarantee for code that runs on customer pages (surveys, survey-ui,
 * js-core, creatives). Customers embed these bundles under a `style-src` with no 'unsafe-inline', where
 * the browser reports every element it PARSES with a `style` attribute, and every `<style>` without the
 * page's nonce, as a violation on their site.
 *
 * This flags the APIs that parse or inject markup, so a new one is a deliberate, reviewed choice. It cannot
 * see data: whether a string carries a `style` attribute is only known at runtime, which is what
 * `apps/web/playwright/survey-csp.spec.ts` renders in a real browser. Keep the two together.
 *
 * The sanctioned path is `stripInlineStyles` / `sanitizeSurveyHtml` from `@formbricks/survey-ui`. A line that
 * has to use one of these APIs anyway disables the rule with the reason it is safe:
 *   // oxlint-disable-next-line formbricks/restricted-syntax -- <what makes this CSP-safe>
 *
 * oxlint has no `no-restricted-syntax`; `formbricks/restricted-syntax` (plugins/formbricks.mjs) takes
 * the same selector options.
 */

const FIX =
  "Under a strict CSP the browser reports every element parsed with a style attribute. Pass the markup " +
  "through stripInlineStyles (@formbricks/survey-ui) first, then disable formbricks/restricted-syntax on the line with the reason.";

const restrictedSyntax = [
  {
    selector: "NewExpression[callee.name='DOMParser']",
    message: `new DOMParser() parses markup. ${FIX}`,
  },
  {
    selector:
      "AssignmentExpression[left.type='MemberExpression'][left.property.name=/^(innerHTML|outerHTML)$/]",
    message: `Assigning innerHTML/outerHTML parses markup. For CSS or plain text use textContent; otherwise ${FIX}`,
  },
  {
    selector:
      "CallExpression[callee.property.name=/^(insertAdjacentHTML|createContextualFragment|setHTMLUnsafe|parseHTMLUnsafe)$/]",
    message: `This parses markup. ${FIX}`,
  },
  {
    selector: "CallExpression[callee.object.name='document'][callee.property.name=/^(write|writeln)$/]",
    message: `document.write parses markup. ${FIX}`,
  },
  {
    selector: "CallExpression[callee.property.name='setAttribute'][arguments.0.value=/^style$/i]",
    message:
      "setAttribute('style') is an inline style the page's style-src blocks. Set properties through element.style (CSSOM), which a strict CSP allows, or use a class.",
  },
  {
    selector: "CallExpression[callee.property.name='createElement'][arguments.0.value=/^style$/i]",
    message:
      "A <style> element is blocked unless it carries the nonce the host page registered with setNonce(). Set the nonce attribute before attaching it, then disable formbricks/restricted-syntax on the line.",
  },
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: `dangerouslySetInnerHTML parses markup. Its input must come from sanitizeSurveyHtml (@formbricks/survey-ui); disable formbricks/restricted-syntax on the line with that reason.`,
  },
];

export const cspSafe = {
  jsPlugins: [jsPlugins.formbricks],
  overrides: [
    {
      files: ["src/**/*.{ts,tsx}"],
      excludeFiles: ["**/*.test.*", "**/*.stories.*", "**/story-helpers.tsx", "**/__mocks__/**"],
      rules: { "formbricks/restricted-syntax": ["error", ...restrictedSyntax] },
    },
  ],
};

export default cspSafe;
