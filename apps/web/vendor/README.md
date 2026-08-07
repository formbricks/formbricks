# Vendored dependencies

Third-party packages that cannot be installed from the npm registry and are
committed here as tarballs instead. Keep this directory to the minimum — a
vendored dependency skips registry provenance and Dependabot, so every entry
needs a reason.

## `xlsx-0.20.3.tgz`

SheetJS (`xlsx`) no longer publishes to npm. The registry copy is frozen on an
old release with known security advisories; the fixed builds are distributed
only from SheetJS's own CDN. `0.20.3` is that patched build, vendored here and
referenced from `apps/web/package.json` as:

```json
"xlsx": "file:vendor/xlsx-0.20.3.tgz"
```

Added in #6321 (XLSX security update → SheetJS). To upgrade: download the new
tarball from https://cdn.sheetjs.com, replace this file, and bump the version in
both the filename and the `package.json` reference.
