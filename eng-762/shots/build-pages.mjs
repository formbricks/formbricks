import { mkdirSync, writeFileSync } from "node:fs";
import {
  badge,
  button,
  card,
  idBadge,
  label,
  page,
  tableAfter,
  tableAfterPr1,
  tableBefore,
} from "./lib.mjs";

const OUT = new URL("./pages/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const write = (name, html) => writeFileSync(new URL(name, OUT), html);

/* ------------------------------------------------------------------ PR 8837 */
/* Header type + row hairline + hover. Shown on the four already-Table settings
   tables that were hand-writing the defaults. */

const teamHeadsBefore = [
  { label: "Team name", cls: "font-medium text-slate-500" },
  { label: "Size", cls: "font-medium text-slate-500" },
  { label: "Team ID", cls: "font-medium text-slate-500" },
  { label: "Permission", cls: "font-medium text-slate-500" },
];
const teamHeadsAfter = [
  { label: "Team name" },
  { label: "Size" },
  { label: "Team ID" },
  { label: "Permission" },
];
const teamRows = [
  ["Product", "4 members", idBadge("cm4x9q2ab000"), "Read & write"],
  ["Design", "2 members", idBadge("cm4x9q2cd001"), "Read"],
  ["Growth", "7 members", idBadge("cm4x9q2ef002"), "Manage"],
].map(([name, size, id, perm]) => ({
  cells: [
    { html: name, cls: "font-medium" },
    { html: size },
    { html: id },
    { html: `<p class="capitalize">${perm}</p>` },
  ],
}));

// Enterprise features: the one table whose header was white.
const entHeads = [
  { label: "Feature" },
  { label: "Access" },
  { label: "Value" },
  { label: "Documentation" },
];
const docsLink =
  '<a class="text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">Read docs</a>';
const entRows = [
  ["Hide “Powered by Formbricks”", badge("Enabled", "success"), "—"],
  ["Teams & access roles", badge("Enabled", "success"), "—"],
  ["Custom workspace count", badge("Enabled", "success"), "Unlimited"],
  ["Audit logs", badge("Disabled", "gray"), "—"],
].map(([name, acc, val]) => ({
  cells: [
    { html: name, cls: "font-medium text-slate-900" },
    { html: acc },
    { html: val, cls: "text-slate-600" },
    { html: docsLink },
  ],
}));

write(
  "8837-before-settings-tables.html",
  page(
    "before",
    label("before") +
      card({
        title: "Team access",
        description: "Teams with access to this workspace.",
        body: `<div class="overflow-hidden rounded-lg">${tableBefore({
          heads: teamHeadsBefore,
          rows: teamRows.map((r) => ({
            ...r,
            rowCls: "border-slate-200 hover:bg-transparent",
          })),
          bodyClass: "[&_tr:last-child]:border-b",
        })}</div>`,
      }) +
      card({
        title: "License features",
        description: "What this license unlocks.",
        bodyClass: "",
        body: tableBefore({
          heads: entHeads,
          rows: entRows.map((r) => ({ ...r, rowCls: "hover:bg-white" })),
          headRowClass: "hover:bg-white",
        }),
      }),
  ),
);

write(
  "8837-after-settings-tables.html",
  page(
    "after",
    label("after") +
      card({
        title: "Team access",
        description: "Teams with access to this workspace.",
        body: `<div class="overflow-hidden rounded-lg">${tableAfterPr1({
          heads: teamHeadsBefore,
          rows: teamRows,
          bodyClass: "[&_tr:last-child]:border-b",
        })}</div>`,
      }) +
      card({
        title: "License features",
        description: "What this license unlocks.",
        bodyClass: "",
        body: tableAfterPr1({
          heads: entHeads,
          rows: entRows,
          headRowClass: "",
        }),
      }),
  ),
);

/* ------------------------------------------------------------------ PR 8838 */
/* bodyVariant=flush: the card's py-4 no longer leaves a strip of white under an
   edge-to-edge table, and the last row is clipped by the card's own radius. */

const flushBody = tableAfter({ heads: entHeads, rows: entRows });

write(
  "8838-before-card-bottom.html",
  page(
    "before",
    label("before — noPadding") +
      card({
        title: "License features",
        description:
          "noPadding removed the gutter but left the card's bottom py-4.",
        bodyClass: "",
        body: flushBody,
      }),
  ),
);

write(
  "8838-after-card-bottom.html",
  page(
    "after",
    label("after — bodyVariant=flush") +
      card({
        title: "License features",
        description:
          "-mb-4 cancels the bottom padding; overflow-hidden clips at the card's radius.",
        bodyClass: "-mb-4",
        extra: "overflow-hidden",
        body: flushBody,
      }),
  ),
);

/* ------------------------------------------------------------------ PR 8839 */
/* Pretty URLs: its own inset rounded box becomes the card's frame. */

const prettyHeadsBefore = [
  { label: "Survey name", cls: "font-medium text-slate-500" },
  { label: "Workspace", cls: "font-medium text-slate-500" },
  { label: "Pretty URL", cls: "font-medium text-slate-500" },
];
const prettyHeadsAfter = [
  { label: "Survey name", cls: "w-[40%]" },
  { label: "Workspace", cls: "w-[30%]" },
  { label: "Pretty URL", cls: "w-[30%]" },
];
const surveyLink = (n) =>
  `<a class="text-slate-900 hover:text-slate-700 hover:underline">${n}</a>`;
const prettyRows = [
  ["Onboarding NPS", "Acme Web", "onboarding-nps"],
  ["Churn survey", "Acme Web", "churn-2026"],
  ["Feature feedback", "Acme Mobile", "feature-feedback"],
].map(([name, ws, slug]) => ({
  cells: [
    { html: surveyLink(name), cls: "font-medium" },
    { html: ws },
    { html: idBadge(slug) },
  ],
}));

write(
  "8839-before-pretty-urls.html",
  page(
    "before",
    label("before") +
      card({
        title: "Pretty URLs",
        description: "Custom link slugs for surveys in this organization.",
        body: `<div class="overflow-hidden rounded-lg">${tableBefore({
          heads: prettyHeadsBefore,
          rows: prettyRows.map((r) => ({
            ...r,
            rowCls: "border-slate-200 hover:bg-transparent",
          })),
          bodyClass: "[&_tr:last-child]:border-b",
        })}</div>`,
      }),
  ),
);

write(
  "8839-after-pretty-urls.html",
  page(
    "after",
    label("after") +
      card({
        title: "Pretty URLs",
        description: "Custom link slugs for surveys in this organization.",
        bodyClass: "-mb-4",
        extra: "overflow-hidden",
        body: tableAfter({ heads: prettyHeadsAfter, rows: prettyRows }),
      }),
  ),
);

write(
  "8839-after-pretty-urls-empty.html",
  page(
    "after — empty state",
    label("after — empty state") +
      card({
        title: "Pretty URLs",
        description: "Custom link slugs for surveys in this organization.",
        bodyClass: "-mb-4",
        extra: "overflow-hidden",
        body: tableAfter({
          heads: prettyHeadsAfter,
          rows: [
            {
              cells: [
                {
                  html: "No pretty URLs",
                  cls: "h-24 text-center text-sm text-slate-500",
                },
              ],
              rowCls: "",
            },
          ],
        }).replace(
          '<td class="p-4 align-middle h-24',
          '<td colspan="3" class="p-4 align-middle h-24',
        ),
      }),
  ),
);

/* ------------------------------------------------------------------ PR 8840 */
write(
  "8840-before-enterprise-header.html",
  page(
    "before",
    label("before — white header") +
      card({
        title: "License features",
        description: "The only settings table with a white header row.",
        bodyClass: "",
        body: tableBefore({
          heads: entHeads,
          rows: entRows.map((r) => ({ ...r, rowCls: "hover:bg-white" })),
          headRowClass: "hover:bg-white",
        }),
      }),
  ),
);

write(
  "8840-after-enterprise-header.html",
  page(
    "after",
    label("after — tinted header") +
      card({
        title: "License features",
        description: "Now matches every other settings table.",
        bodyClass: "-mb-4",
        extra: "overflow-hidden",
        body: tableAfter({ heads: entHeads, rows: entRows }),
      }),
  ),
);

/* ------------------------------------------------------------------ PR 8841 */
const dirHeadsBefore = [
  { label: "Directory name", cls: "font-medium text-slate-500" },
  { label: "Workspaces", cls: "font-medium text-slate-500" },
  { label: "Status", cls: "font-medium text-slate-500" },
  { label: "" },
];
const dirHeadsAfter = [
  { label: "Directory name", cls: "w-[45%]" },
  { label: "Workspaces", cls: "w-[15%]" },
  { label: "Status", cls: "w-[15%]" },
  { label: '<span class="sr-only">Actions</span>', cls: "w-[25%] text-right" },
];
const dirActions = `${button("View data", "ghost")} ${button("Manage")}`;
const dirRows = (dimSecond) =>
  [
    ["Support tickets", "3", badge("Active", "success"), dirActions],
    [
      "App reviews",
      "1",
      badge("Active", "success"),
      `${button("View data", "ghost")} ${button("Manage")}`,
    ],
    ["Legacy imports", "0", badge("Archived", "gray"), button("Unarchive")],
  ].map(([name, count, status, actions], i) => ({
    rowCls: dimSecond && i !== 1 ? "pointer-events-none opacity-60" : "",
    cells: [
      { html: name },
      { html: count },
      { html: status },
      { html: actions, cls: "flex justify-end gap-2 text-right" },
    ],
  }));

write(
  "8841-before-feedback-directories.html",
  page(
    "before",
    label("before") +
      card({
        title: "Feedback directories",
        description: "Shared directories across workspaces.",
        body: `<div class="overflow-hidden rounded-lg border">${tableBefore({
          heads: dirHeadsBefore,
          rows: dirRows(false).map((r) => ({
            ...r,
            rowCls: "hover:bg-transparent",
          })),
          bodyClass: "[&_tr:last-child]:border-b",
        })}</div>`,
      }),
  ),
);

write(
  "8841-after-feedback-directories.html",
  page(
    "after",
    label("after") +
      card({
        title: "Feedback directories",
        description: "Shared directories across workspaces.",
        bodyClass: "-mb-4",
        extra: "overflow-hidden",
        body: tableAfter({ heads: dirHeadsAfter, rows: dirRows(false) }),
      }),
  ),
);

write(
  "8841-after-feedback-directories-inflight.html",
  page(
    "after — action in flight",
    label("after — “App reviews” action in flight") +
      card({
        title: "Feedback directories",
        description:
          "The acting row stays at full opacity; the others dim so a second request can't race it.",
        bodyClass: "-mb-4",
        extra: "overflow-hidden",
        body: tableAfter({ heads: dirHeadsAfter, rows: dirRows(true) }),
      }),
  ),
);

/* ------------------------------------------------------------------ PR 8842 */
const orgTeamHeadsBefore = [
  { label: "Team name", cls: "font-medium text-slate-500" },
  { label: "Size", cls: "font-medium text-slate-500" },
  { label: "" },
  { label: "" },
];
const orgTeamHeadsAfter = [
  { label: "Team name", cls: "w-[40%]" },
  { label: "Size", cls: "w-[20%]" },
  { label: '<span class="sr-only">You are a member</span>', cls: "w-[20%]" },
  { label: '<span class="sr-only">Actions</span>', cls: "w-[20%] text-right" },
];
const orgTeamRows = [
  [
    "Product",
    "4 members",
    badge("You are a member", "success"),
    button("Manage team"),
  ],
  [
    "Design",
    "2 members",
    badge("You are a member", "success"),
    button("Manage team"),
  ],
  ["Growth", "7 members", "", button("Manage team")],
].map(([name, size, member, actions]) => ({
  cells: [
    { html: name },
    { html: size },
    { html: member },
    { html: actions, cls: "flex justify-end text-right" },
  ],
}));

write(
  "8842-before-org-teams.html",
  page(
    "before",
    label("before") +
      card({
        title: "Teams",
        description: "Manage teams in this organization.",
        body:
          '<div class="mb-4 flex justify-end">' +
          button("Create new team", "primary") +
          "</div>" +
          `<div class="overflow-hidden rounded-lg">${tableBefore({
            heads: orgTeamHeadsBefore,
            rows: orgTeamRows.map((r) => ({
              ...r,
              rowCls: "hover:bg-transparent",
            })),
            bodyClass: "[&_tr:last-child]:border-b",
          })}</div>`,
      }),
  ),
);

write(
  "8842-after-org-teams.html",
  page(
    "after",
    label("after") +
      card({
        title: "Teams",
        description: "Manage teams in this organization.",
        bodyClass: "-mb-4",
        extra: "overflow-hidden",
        body:
          '<div class="mb-4 flex justify-end px-4 pt-4">' +
          button("Create new team", "primary") +
          "</div>" +
          tableAfter({ heads: orgTeamHeadsAfter, rows: orgTeamRows }),
      }),
  ),
);

console.log("pages written");
