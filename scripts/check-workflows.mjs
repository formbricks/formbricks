#!/usr/bin/env node
import yaml from "js-yaml";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const isMap = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Dynamic runners and least-privilege choices still need review. This check covers the
// mechanical rules: explicit permission maps and hardening first on literal ubuntu-* jobs.
export function checkWorkflow(source) {
  const workflow = yaml.load(source);
  if (!isMap(workflow) || !isMap(workflow.jobs)) {
    return ["Expected a workflow with a jobs map."];
  }

  const errors = [];
  if (workflow.permissions !== undefined && !isMap(workflow.permissions)) {
    errors.push("Workflow permissions must be an explicit map; enumerate required scopes.");
  }
  for (const [name, job] of Object.entries(workflow.jobs)) {
    if (!isMap(job)) {
      errors.push(`${name}: expected a job map.`);
      continue;
    }
    if (!isMap(job.permissions ?? workflow.permissions)) {
      errors.push(`${name}: declare an explicit permissions map on the job or workflow.`);
    }
    const labels = isMap(job["runs-on"]) ? job["runs-on"].labels : job["runs-on"];
    const runners = Array.isArray(labels) ? labels : [labels];
    if (!runners.some((runner) => typeof runner === "string" && /^ubuntu-/.test(runner))) continue;
    const first = job.steps?.[0];
    if (
      typeof first?.uses !== "string" ||
      !first.uses.startsWith("step-security/harden-runner@") ||
      (first.if !== undefined && first.if !== true) ||
      (first["continue-on-error"] !== undefined && first["continue-on-error"] !== false)
    ) {
      errors.push(
        `${name}: the first step must run step-security/harden-runner unconditionally and fail on error.`
      );
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = fileURLToPath(new URL("../.github/workflows/", import.meta.url));
  const errors = [];
  for (const file of readdirSync(directory)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()) {
    try {
      errors.push(
        ...checkWorkflow(readFileSync(resolve(directory, file), "utf8")).map((error) => `${file}: ${error}`)
      );
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Workflow permission maps and ubuntu-* runner hardening checks passed.");
  }
}
