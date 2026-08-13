# ENG-762 before/after render harness

Produces the before/after images used in the ENG-762 PR descriptions, without a database.

The sandbox this was built in has no Docker daemon, so the app could not be booted. Instead each image
is the **real component markup** rendered against the **repo's own stylesheet** — `entry.css` imports
`apps/web/modules/ui/globals.css` and compiles it through `@tailwindcss/postcss`, so the theme, the
plugins and the Tailwind v3 border-colour compat shim all apply exactly as they do in the product.

Every class string goes through the same `tailwind-merge` the components use via `cn`. That part is not
optional: hand-concatenating lets `bg-white` and `bg-slate-100` both survive on a header row and leaves
stylesheet order to pick the winner, which silently misrepresents the "before" state.

These are **not** app screenshots. The data is fabricated and the page chrome is absent. Every PR
description says so. A real visual pass is still owed on each.

## Usage

```
node build-css.mjs     # compile the repo's Tailwind against pages/
node build-pages.mjs    # write pages/<pr>-<before|after>-<surface>.html
node shoot.mjs          # screenshot each page to out/*.jpg via /opt/pw-browsers/chromium
```

Then copy `out/<pr>-<name>.jpg` to `pr-<pr>/<name>.jpg` at the root of this same branch
(`assets-itsjavi-prs`) and reference it as
`https://raw.githubusercontent.com/formbricks/formbricks/assets-itsjavi-prs/pr-<pr>/<name>.jpg`.

The scripts resolve `node_modules` and `apps/web/modules/ui/globals.css` from an absolute
`/home/user/formbricks` path, since they were written to run inside a checkout of the product repo
rather than from this artifacts branch. Adjust those paths for wherever you run them.

Run `build-css.mjs` again after adding pages — Tailwind only emits utilities it finds in `pages/`.
