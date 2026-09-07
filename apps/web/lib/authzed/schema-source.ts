import "server-only";
import { readFile } from "node:fs/promises";

const defaultCanonicalSchemaUrl = new URL("../../../../authzed/schema.zed", import.meta.url);

const globalForAuthzedSchema = globalThis as typeof globalThis & {
  authzedCanonicalSchemaUrl?: URL;
};

/** Configure the release-bundled schema without exposing schema contents through the CLI entry point. */
export const configureCanonicalAuthzedSchemaUrl = (moduleUrl: string, relativePath: string): void => {
  globalForAuthzedSchema.authzedCanonicalSchemaUrl = new URL(relativePath, moduleUrl);
};

export const readCanonicalAuthzedSchema = async (): Promise<string> =>
  readFile(globalForAuthzedSchema.authzedCanonicalSchemaUrl ?? defaultCanonicalSchemaUrl, "utf8");
