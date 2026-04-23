/**
 * Writes dist/index.d.ts after `tsc --project tsconfig.build.json` has emitted
 * dist/client.d.ts.
 *
 * Why is this needed?
 * Vite handles the JS bundle (dist/index.js / dist/index.cjs) but does not emit
 * TypeScript declaration files. tsconfig.build.json compiles src/client.ts to
 * produce dist/client.d.ts. This script then creates the barrel declaration that
 * the package's "types" field points at (dist/index.d.ts), re-exporting everything
 * from dist/client.d.ts so consumers get full type information.
 */

const fs = require("node:fs");

fs.writeFileSync("dist/index.d.ts", 'export * from "./client";\n');
