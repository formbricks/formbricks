// Shared markup helpers for the before/after render harness.
// Every class string below is copied verbatim from the repo at the relevant commit, and every one of
// them is put through the SAME twMerge the components use via `cn` — so a conflicting class is dropped
// exactly as it is at runtime. Hand-concatenating instead would let `bg-white` and `bg-slate-100` both
// survive and let stylesheet order decide, which misrepresents the "before" state.
import { twMerge } from "/home/user/formbricks/node_modules/tailwind-merge/dist/bundle-mjs.mjs";

const cn = (...parts) => twMerge(parts.filter(Boolean).join(" "));

export const page = (title, body) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="../out.css"></head>
<body class="bg-slate-50 p-8">
<div class="mx-auto max-w-4xl">${body}</div>
</body></html>`;

/** SettingsCard, as it renders today (py-4 all round, header block with its own border-b). */
export const card = ({
  title,
  description,
  body,
  bodyClass = "px-4 pt-4",
  extra = "",
}) => `
<div class="${cn("relative my-4 w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 text-left shadow-xs", extra)}">
  <div class="flex justify-between border-b border-slate-200 px-4 pb-4">
    <div>
      <h4 class="text-lg font-medium tracking-normal text-slate-900">${title}</h4>
      <p class="mt-1 text-sm text-slate-500">${description}</p>
    </div>
  </div>
  <div class="${bodyClass}">${body}</div>
</div>`;

/**
 * BEFORE: the shadcn Table primitive with its original defaults.
 * thead: pointer-events-none · tr: border-b (resolves to gray-200 via the compat shim) + hover:bg-slate-100
 * th: no font/colour of its own · tbody: [&_tr:last-child]:border-0
 */
export const tableBefore = ({
  heads,
  rows,
  headRowClass = "bg-slate-100",
  bodyClass = "",
}) => `
<div class="relative overflow-auto">
  <table class="w-full caption-bottom text-sm">
    <thead class="pointer-events-none text-slate-800 [&_tr]:border-b">
      <tr class="${cn("border-b bg-white transition-colors hover:bg-slate-100", headRowClass)}">
        ${heads.map((h) => `<th class="${cn("h-12 px-4 text-left align-middle", h.cls)}">${h.label}</th>`).join("")}
      </tr>
    </thead>
    <tbody class="[&_tr:last-child]:border-0 ${bodyClass}">
      ${rows
        .map(
          (
            cells,
          ) => `<tr class="${cn("border-b bg-white transition-colors hover:bg-slate-100", cells.rowCls)}">
        ${cells.cells.map((c) => `<td class="${cn("p-4 align-middle", c.cls)}">${c.html}</td>`).join("")}
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>
</div>`;

/**
 * AFTER: the same primitive with the unified defaults.
 * tr: border-b border-slate-200, no inherited hover · th: font-medium text-slate-500
 */
export const tableAfter = ({ heads, rows, bodyClass = "" }) => `
<div class="relative overflow-auto">
  <table class="w-full caption-bottom text-sm">
    <thead class="text-slate-800 [&_tr]:border-b">
      <tr class="border-b border-slate-200 bg-slate-100 transition-colors">
        ${heads
          .map(
            (h) =>
              `<th class="${cn("h-12 px-4 text-left align-middle font-medium text-slate-500", h.cls)}">${h.label}</th>`,
          )
          .join("")}
      </tr>
    </thead>
    <tbody class="[&_tr:last-child]:border-0 ${bodyClass}">
      ${rows
        .map(
          (
            cells,
          ) => `<tr class="${cn("border-b border-slate-200 bg-white transition-colors", cells.rowCls)}">
        ${cells.cells.map((c) => `<td class="${cn("p-4 align-middle", c.cls)}">${c.html}</td>`).join("")}
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>
</div>`;

export const idBadge = (id) =>
  `<span class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">${id}</span>`;

export const badge = (text, tone) => {
  const tones = {
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    gray: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}">${text}</span>`;
};

export const button = (label, variant = "secondary") => {
  const variants = {
    secondary:
      "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
    ghost: "text-slate-900 hover:bg-slate-100",
    primary: "bg-slate-900 text-white",
    destructive: "bg-red-500 text-slate-50",
  };
  return `<button type="button" class="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium ${variants[variant]}">${label}</button>`;
};

export const label = (text) =>
  `<div class="mb-2 inline-flex rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold tracking-wide text-white uppercase">${text}</div>`;

/**
 * AFTER as #8837 actually ships it, once the review fix landed: the primitive gains
 * `border-slate-200` on the row and loses the inherited hover, and nothing else. Header type is
 * unchanged, so a consumer's own `font-medium text-slate-500` still does that work.
 */
export const tableAfterPr1 = ({
  heads,
  rows,
  headRowClass = "bg-slate-100",
  bodyClass = "",
}) => `
<div class="relative overflow-auto">
  <table class="w-full caption-bottom text-sm">
    <thead class="text-slate-800 [&_tr]:border-b">
      <tr class="${cn("border-b border-slate-200 bg-white transition-colors", headRowClass)}">
        ${heads.map((h) => `<th class="${cn("h-12 px-4 text-left align-middle", h.cls)}">${h.label}</th>`).join("")}
      </tr>
    </thead>
    <tbody class="[&_tr:last-child]:border-0 ${bodyClass}">
      ${rows
        .map(
          (
            cells,
          ) => `<tr class="${cn("border-b border-slate-200 bg-white transition-colors", cells.rowCls)}">
        ${cells.cells.map((c) => `<td class="${cn("p-4 align-middle", c.cls)}">${c.html}</td>`).join("")}
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>
</div>`;
