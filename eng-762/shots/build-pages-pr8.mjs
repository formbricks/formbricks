// Before/after pages for the final ENG-762 PR: user actions, tags, notification alerts,
// feedback sources. The "before" side of all four is a hand-rolled CSS grid rather than a <table>, so
// lib.mjs's tableBefore does not apply — the grid markup below is copied verbatim from the files at
// origin/main, class for class, and the "after" side goes through lib.mjs's tableAfter.
import { mkdirSync, writeFileSync } from "node:fs";
import { badge, button, card, label, page, tableAfter } from "./lib.mjs";

const OUT = new URL("./pages/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const write = (name, html) => writeFileSync(new URL(name, OUT), html);

/** Stand-in for a lucide action-type icon at the size the row uses. */
const icon = () =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5"><path d="M9 9l5 12 1.8-5.2L21 14z"/><path d="M7.2 2.2 8 5.1"/><path d="m5.1 8-2.9-.8"/></svg>`;

/** The repo's Input, at the height the tag row gives it. */
const input = (value) =>
  `<div class="flex h-10 w-full items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900">${value}</div>`;

/** frame="card" — the container SettingsTable draws when it stands on its own. */
const frameCard = (inner) =>
  `<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">${inner}</div>`;

/* ------------------------------------------------------------------ user actions */

const ACTIONS = [
  ["Clicked checkout", "Fires when the checkout button is pressed", "2 days ago"],
  ["Viewed pricing", "Any visit to /pricing", "12 days ago"],
  ["Signup completed", "Code action sent from the app", "about 1 month ago"],
];

const actionRowBefore = ([name, description, created]) => `
<button type="button" class="w-full" title="${name}">
  <div class="m-2 grid grid-cols-6 content-center rounded-lg transition-colors ease-in-out">
    <div class="col-span-4 flex items-start py-3 pl-6 text-sm">
      <div class="flex w-full items-center gap-4">
        <div class="mt-1 size-5 shrink-0 text-slate-500">${icon()}</div>
        <div class="text-left">
          <div class="font-medium wrap-break-word text-slate-900">${name}</div>
          <div class="text-xs wrap-break-word text-slate-400">${description}</div>
        </div>
      </div>
    </div>
    <div class="col-span-2 my-auto text-center text-sm whitespace-nowrap text-slate-500">${created}</div>
  </div>
</button>`;

write(
  "actions-before.html",
  page(
    "before",
    label("before") +
      card({
        title: "Actions",
        description: "Actions are events that happen in your app.",
        body: `
<div class="rounded-xl border border-slate-200 bg-white shadow-xs">
  <div class="grid h-12 grid-cols-6 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
    <span class="sr-only">Edit</span>
    <div class="col-span-4 pl-6">User actions</div>
    <div class="col-span-2 text-center">Created</div>
  </div>
  <div class="flex flex-col">${ACTIONS.map(actionRowBefore).join("")}</div>
</div>`,
      }),
  ),
);

write(
  "actions-after.html",
  page(
    "after",
    label("after") +
      card({
        title: "Actions",
        description: "Actions are events that happen in your app.",
        bodyClass: "-mb-4",
        extra: "overflow-hidden",
        body: tableAfter({
          heads: [{ label: "User actions" }, { label: "Created", cls: "text-center" }],
          rows: ACTIONS.map(([name, description, created]) => ({
            cells: [
              {
                html: `<div class="flex items-center gap-4">
                  <div class="size-5 shrink-0 text-slate-500">${icon()}</div>
                  <div class="text-left">
                    <div class="font-medium wrap-break-word text-slate-900">${name}</div>
                    <div class="text-xs wrap-break-word text-slate-400">${description}</div>
                  </div>
                </div>`,
              },
              { html: created, cls: "text-center whitespace-nowrap text-slate-500" },
            ],
          })),
        }),
      }),
  ),
);

/* ------------------------------------------------------------------ tags */

const TAGS = [
  ["Bug report", "18"],
  ["Feature request", "42"],
  ["Churn risk", "3"],
];

const tagActionsHtml = `<div class="flex items-center justify-center gap-2">${button("Merge")}${button(
  "Delete",
  "destructive",
)}</div>`;

const tagRowBefore = ([name, count]) => `
<div class="w-full">
  <div class="grid h-16 grid-cols-4 content-center rounded-lg">
    <div class="col-span-2 flex items-center text-sm">
      <div class="w-full text-left">${input(name)}</div>
    </div>
    <div class="col-span-1 my-auto text-center text-sm whitespace-nowrap text-slate-500">
      <div class="text-slate-900">${count}</div>
    </div>
    <div class="col-span-1 my-auto flex items-center justify-center gap-2 text-center text-sm whitespace-nowrap text-slate-500">
      ${button("Merge")}${button("Delete", "destructive")}
    </div>
  </div>
</div>`;

write(
  "tags-before.html",
  page(
    "before",
    label("before") +
      card({
        title: "Manage tags",
        description: "Add or remove tags in your workspace.",
        body: `
<div class="">
  <div class="grid grid-cols-4 content-center rounded-lg bg-white text-left text-sm font-semibold text-slate-900">
    <div class="col-span-2">Tag</div>
    <div class="col-span-1 text-center">Count</div>
    <div class="col-span-1 flex justify-center text-center">Actions</div>
  </div>
  ${TAGS.map(tagRowBefore).join("")}
</div>`,
      }),
  ),
);

write(
  "tags-after.html",
  page(
    "after",
    label("after") +
      card({
        title: "Manage tags",
        description: "Add or remove tags in your workspace.",
        bodyClass: "-mb-4",
        extra: "overflow-hidden",
        body: tableAfter({
          heads: [
            { label: "Tag", cls: "w-[50%]" },
            { label: "Count", cls: "w-[15%] text-center" },
            { label: "Actions", cls: "w-[35%] text-center" },
          ],
          rows: TAGS.map(([name, count]) => ({
            cells: [
              { html: input(name) },
              { html: count, cls: "text-center whitespace-nowrap text-slate-900" },
              { html: tagActionsHtml },
            ],
          })),
        }),
      }),
  ),
);

/* ------------------------------------------------------------------ notification alerts */

const SURVEYS = [
  ["Onboarding NPS", "Acme Web"],
  ["Churn survey", "Acme Web"],
  ["Feature feedback", "Acme Mobile"],
];

const alertSwitch = `<span class="inline-flex h-5 w-9 items-center rounded-full bg-slate-900 p-0.5"><span class="ml-auto size-4 rounded-full bg-white"></span></span>`;

const orgHeaderBlock = `
<div class="mb-5 grid grid-cols-6 items-center gap-x-3">
  <div class="col-span-3 flex items-center gap-x-3">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-6 w-7 text-slate-600"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>
    <p class="text-sm font-medium text-slate-800">Acme Inc</p>
  </div>
  <div class="col-span-3 flex items-center justify-end pr-2">
    <p class="pr-4 text-sm text-slate-600">Auto-subscribe to new surveys</p>
    ${alertSwitch}
  </div>
</div>`;

const alertFooter = `
<p class="pb-3 pl-4 text-xs text-slate-400">
  Want to loop in your organization mates? <a class="font-semibold" href="#">Invite them</a>
</p>`;

write(
  "alerts-before.html",
  page(
    "before",
    label("before") +
      card({
        title: "Email alerts (surveys)",
        description: "Set up an alert to get an email on new responses.",
        body:
          orgHeaderBlock +
          `
<div class="mb-6 rounded-lg border border-slate-200">
  <div class="grid h-12 grid-cols-3 content-center rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
    <div class="col-span-2 flex items-center">Surveys</div>
    <div class="col-span-1 flex cursor-default items-center justify-center gap-x-2">
      <span>Every response</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4 shrink-0 text-slate-500"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
    </div>
  </div>
  <div class="grid-cols-8 space-y-1 p-2">
    ${SURVEYS.map(
      ([name, workspace]) => `
    <div class="grid h-auto w-full cursor-pointer grid-cols-3 place-content-center rounded-lg px-2 py-2 text-left text-sm text-slate-900">
      <div class="col-span-2 text-left">
        <div class="font-medium text-slate-900">${name}</div>
        <div class="text-xs text-slate-400">${workspace}</div>
      </div>
      <div class="col-span-1 text-center">${alertSwitch}</div>
    </div>`,
    ).join("")}
  </div>
  ${alertFooter}
</div>`,
      }),
  ),
);

write(
  "alerts-after.html",
  page(
    "after",
    label("after") +
      card({
        title: "Email alerts (surveys)",
        description: "Set up an alert to get an email on new responses.",
        body:
          orgHeaderBlock +
          `<div class="mb-6">` +
          frameCard(
            tableAfter({
              heads: [
                { label: "Surveys", cls: "w-[70%]" },
                {
                  label: `<span class="inline-flex cursor-default items-center gap-x-2"><span>Every response</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4 shrink-0 text-slate-500"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg></span>`,
                  cls: "w-[30%] text-center",
                },
              ],
              rows: SURVEYS.map(([name, workspace]) => ({
                cells: [
                  {
                    html: `<div class="font-medium text-slate-900">${name}</div><div class="text-xs text-slate-400">${workspace}</div>`,
                  },
                  { html: `<div class="flex justify-center">${alertSwitch}</div>`, cls: "text-center" },
                ],
              })),
            }) + alertFooter,
          ) +
          `</div>`,
      }),
  ),
);

/* ------------------------------------------------------------------ feedback sources */

const SOURCES = [
  ["Survey", "Onboarding NPS", "Onboarding NPS", "Live sync", "success", "2 hours ago", "Dhruwang"],
  ["CSV", "Q1 support export", null, "Ready", "success", "3 days ago", "Javier"],
  ["Survey", "Churn survey", "Churn survey", "Disabled", "gray", "12 days ago", "Matti"],
];

const kebab = `<span class="inline-flex size-8 items-center justify-center rounded-md text-slate-500"><svg viewBox="0 0 24 24" fill="currentColor" class="size-4"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></span>`;

const sourceIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4 shrink-0 text-slate-500"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-5"/></svg>`;

write(
  "sources-before.html",
  page(
    "before",
    label("before") +
      `
<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
  <div class="grid h-12 grid-cols-12 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
    <div class="col-span-2 pl-6">Type</div>
    <div class="col-span-2">Name</div>
    <div class="col-span-2">Data origin</div>
    <div class="col-span-2 text-center">Status</div>
    <div class="col-span-2 text-center">Updated at</div>
    <div class="col-span-1 text-center">Created by</div>
    <div class="col-span-1"></div>
  </div>
  <div class="divide-y divide-slate-100">
    ${SOURCES.map(
      ([type, name, origin, status, tone, updated, creator]) => `
    <div class="grid h-12 min-h-12 grid-cols-12 content-center transition-colors ease-in-out">
      <button type="button" class="col-span-4 grid cursor-pointer grid-cols-4 content-center p-2 text-left">
        <div class="col-span-2 flex items-center gap-2 pl-4">${sourceIcon}${badge(type, "gray")}</div>
        <div class="col-span-2 flex items-center"><span class="truncate text-sm font-medium text-slate-900">${name}</span></div>
      </button>
      <div class="col-span-2 flex min-w-0 items-center px-2">
        ${
          origin
            ? `<a href="#" class="truncate text-sm text-slate-700 underline underline-offset-2">${origin}</a>`
            : `<span class="text-sm text-slate-400">—</span>`
        }
      </div>
      <button type="button" class="col-span-5 grid cursor-pointer grid-cols-5 content-center p-2 text-left">
        <div class="col-span-2 flex items-center justify-center">${badge(status, tone)}</div>
        <div class="col-span-2 flex items-center justify-center text-sm text-slate-500">${updated}</div>
        <div class="col-span-1 flex items-center justify-center text-sm text-slate-500"><span class="truncate">${creator}</span></div>
      </button>
      <div class="col-span-1 flex items-center justify-end pr-2">${kebab}</div>
    </div>`,
    ).join("")}
  </div>
</div>`,
  ),
);

write(
  "sources-after.html",
  page(
    "after",
    label("after") +
      frameCard(
        tableAfter({
          heads: [
            { label: "Type", cls: "w-[14%]" },
            { label: "Name", cls: "w-[20%]" },
            { label: "Data origin", cls: "w-[20%]" },
            { label: "Status", cls: "w-[14%] text-center" },
            { label: "Updated at", cls: "w-[14%] text-center whitespace-nowrap" },
            { label: "Created by", cls: "w-[12%] text-center whitespace-nowrap" },
            { label: "", cls: "w-[6%]" },
          ],
          rows: SOURCES.map(([type, name, origin, status, tone, updated, creator]) => ({
            cells: [
              { html: `<div class="flex items-center gap-2">${sourceIcon}${badge(type, "gray")}</div>` },
              { html: name, cls: "font-medium text-slate-900" },
              {
                html: origin
                  ? `<a href="#" class="text-sm text-slate-700 underline underline-offset-2">${origin}</a>`
                  : `<span class="text-sm text-slate-400">—</span>`,
              },
              { html: badge(status, tone), cls: "text-center" },
              { html: updated, cls: "text-center text-slate-500" },
              { html: creator, cls: "text-center text-slate-500" },
              { html: `<div class="flex justify-end">${kebab}</div>` },
            ],
          })),
        }),
      ),
  ),
);

console.log("pr8 pages written");
