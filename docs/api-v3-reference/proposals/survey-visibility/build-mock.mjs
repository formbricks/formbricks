#!/usr/bin/env node
/*
 * Overlay the survey-visibility delta (./openapi.yml) onto the committed v3 bundle
 * (../../openapi.yml) and write the complete contract to ./.generated/openapi.mock.yml.
 *
 * The delta on its own describes only what changes; OpenAPI has no inheritance, so a mock or a
 * generated client fed the delta alone would lose every existing parameter and schema. This script
 * is the "overlay" step: it starts from the real bundle and applies the delta's intent —
 *
 *   - new paths are added as they are;
 *   - `GET /api/v3/surveys` keeps the bundle's operation, gains the delta's extra query parameters
 *     (matched by name) and takes the delta's 200 response, whose list item carries the new fields;
 *   - `SurveyListItem` and `SurveyResource` become `allOf: [<bundle schema>, SurveyVisibilityFields]`;
 *   - `Problem.code` becomes the union of both enums;
 *   - every other component the delta introduces is added; components the bundle already has win.
 *
 * Stdlib plus the workspace's `yaml` package. Output is gitignored; rebuild after editing either input.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(here, "..", "..", "openapi.yml");
const deltaPath = join(here, "openapi.yml");
const outDir = join(here, ".generated");
const outPath = join(outDir, "openapi.mock.yml");

const bundle = parse(readFileSync(bundlePath, "utf8"));
const delta = parse(readFileSync(deltaPath, "utf8"));
const out = structuredClone(bundle);

const WRAPPED_SCHEMAS = ["SurveyListItem", "SurveyResource"];
const FIELDS_REF = { $ref: "#/components/schemas/SurveyVisibilityFields" };

// --- components -------------------------------------------------------------------------------
for (const section of ["schemas", "responses", "parameters"]) {
  out.components[section] ??= {};
  for (const [name, value] of Object.entries(delta.components[section] ?? {})) {
    if (section === "schemas" && WRAPPED_SCHEMAS.includes(name)) {
      const base = out.components.schemas[name];
      if (!base) throw new Error(`bundle has no schema ${name} to wrap`);
      out.components.schemas[name] = {
        description: `${name} as in the bundle, plus the survey-visibility fields.`,
        allOf: [base, FIELDS_REF],
      };
      continue;
    }
    if (section === "schemas" && name === "Problem") {
      const codes = new Set([
        ...out.components.schemas.Problem.properties.code.enum,
        ...value.properties.code.enum,
      ]);
      out.components.schemas.Problem.properties.code.enum = [...codes].sort();
      continue;
    }
    if (name in out.components[section]) continue; // the bundle's definition wins
    out.components[section][name] = value;
  }
}

// --- paths ------------------------------------------------------------------------------------
for (const [path, item] of Object.entries(delta.paths)) {
  if (!(path in out.paths)) {
    out.paths[path] = item;
    continue;
  }
  if (path === "/api/v3/surveys") {
    const target = out.paths[path].get;
    // A parameter may be inline (`name`) or a `$ref` to components/parameters; compare by wire name.
    const paramName = (p) =>
      p.name ?? out.components.parameters[p.$ref.replace("#/components/parameters/", "")]?.name;
    const existing = new Set(target.parameters.map(paramName));
    for (const param of item.get.parameters) {
      if (!existing.has(paramName(param))) target.parameters.push(param);
    }
    target.responses["200"] = item.get.responses["200"];
    target.description = item.get.description;
    continue;
  }
  // `/api/v3/surveys/{surveyId}`: the bundle's full operation stays; SurveyResource is wrapped above.
}

// --- inherited examples ---------------------------------------------------------------------
// Wrapping the schemas makes `visibility`, `owner` and `access` required, so every survey example the
// bundle already carries would fail `no-invalid-media-type-examples`. Give them the day-one values:
// workspace-visible, owned by the creator when there is one, seen through workspace access.
const isSurveyPayload = (v) =>
  v && typeof v === "object" && !Array.isArray(v) && typeof v.id === "string" && "workspaceId" in v;
const withVisibilityFields = (survey) =>
  "visibility" in survey
    ? survey
    : {
        ...survey,
        visibility: "workspace",
        owner: survey.creator?.name ? { name: survey.creator.name } : null,
        access: { via: "workspace", canManageVisibility: false },
      };
for (const [path, item] of Object.entries(out.paths)) {
  if (!path.startsWith("/api/v3/surveys") || path.endsWith("/visibility")) continue;
  for (const op of Object.values(item)) {
    for (const response of Object.values(op.responses ?? {})) {
      const media = response.content?.["application/json"];
      if (!media) continue;
      const examples = media.examples ? Object.values(media.examples).map((e) => e.value) : [];
      if (media.example) examples.push(media.example);
      for (const example of examples) {
        if (!example || typeof example !== "object") continue;
        if (Array.isArray(example.data)) {
          example.data = example.data.map((row) => (isSurveyPayload(row) ? withVisibilityFields(row) : row));
        } else if (isSurveyPayload(example.data)) {
          example.data = withVisibilityFields(example.data);
        }
      }
    }
  }
}

out.info.title = `${bundle.info.title} — with survey visibility (generated mock contract)`;
out.info.description =
  `GENERATED by proposals/survey-visibility/build-mock.mjs — do not edit. Bundle plus the ` +
  `survey-visibility delta; see that directory's README.\n\n${bundle.info.description}`;

mkdirSync(outDir, { recursive: true });
writeFileSync(
  outPath,
  `# GENERATED by build-mock.mjs — do not edit or commit. Rebuild after editing openapi.yml here or the bundle.\n` +
    stringify(out, { lineWidth: 0 })
);
console.log(`wrote ${outPath}`);
