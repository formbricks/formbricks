import { access, copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { type Plugin, type ResolvedConfig } from "vite";

interface CopyCompiledAssetsPluginOptions {
  filename: string;
  distDir: string;
  skipDirectoryCheck?: boolean; // New option to skip checking non-existent directories
  localesDir?: string; // Locale JSON to publish beside the bundle for on-demand loading
  fontsDir?: string; // Font files (and their licenses) to publish beside the bundle for on-demand loading
}

const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  try {
    await access(dirPath);
  } catch (error) {
    if ((error as { code: string }).code === "ENOENT") {
      await mkdir(dirPath, { recursive: true });
    } else {
      throw error;
    }
  }
};

/**
 * Replace `destDir` with the files of `srcDir` that `include` accepts, returning how many were copied.
 *
 * Replaced rather than copied over. Turbo captures every file the directory's output glob matches after
 * the task runs, whoever wrote it, so a file left behind by an older build (a renamed locale, a dropped
 * font) would be captured into the cache entry and restored on every hit — outliving its source, and
 * making the same cache key hold different bytes run to run.
 */
const replaceDirectory = async (
  srcDir: string,
  destDir: string,
  include: (file: string) => boolean
): Promise<number> => {
  await rm(destDir, { recursive: true, force: true });
  await ensureDirectoryExists(destDir);

  const files = (await readdir(srcDir)).filter(include);
  for (const file of files) {
    await copyFile(path.resolve(srcDir, file), path.resolve(destDir, file));
  }

  return files.length;
};

const isMissing = (error: unknown): boolean => (error as { code: string }).code === "ENOENT";

/**
 * Whether `distDir` exists. A missing directory throws, unless `skipDirectoryCheck` is set: then it
 * returns false and the plugin skips the copy.
 */
const distDirExists = async (distDir: string, skipDirectoryCheck: boolean | undefined): Promise<boolean> => {
  try {
    await access(distDir);
    return true;
  } catch (error) {
    if (!isMissing(error)) throw error;
    console.error(`Error: Distribution directory ${distDir} does not exist`);
    if (!skipDirectoryCheck) throw error;
    console.log(`Skipping directory check as skipDirectoryCheck is enabled`);
    return false;
  }
};

/** Copies one dist entry if it is a regular file, returning whether it was copied. */
const copyDistFile = async (srcFile: string, destFile: string, skipDirectoryCheck: boolean | undefined) => {
  try {
    // Check if the srcFile is a regular file before copying
    const fileStat = await stat(srcFile);
    if (!fileStat.isFile()) return false; // Skip directories, or other non-regular files

    await copyFile(srcFile, destFile);
    return true;
  } catch (error) {
    if (isMissing(error) && skipDirectoryCheck) {
      console.log(`Skipping non-existent file: ${srcFile}`);
      return false;
    }
    throw error;
  }
};

/** Copies the files of `distDir` into `outputDir`, renaming `index` to the bundle's filename. */
const copyDistFiles = async (
  distDir: string,
  outputDir: string,
  options: CopyCompiledAssetsPluginOptions
): Promise<number> => {
  let copiedFiles = 0;
  for (const file of await readdir(distDir)) {
    const srcFile = path.resolve(distDir, file);
    const destFile = path.resolve(outputDir, file.replace("index", options.filename));
    if (await copyDistFile(srcFile, destFile, options.skipDirectoryCheck)) copiedFiles++;
  }
  return copiedFiles;
};

export function copyCompiledAssetsPlugin(options: CopyCompiledAssetsPluginOptions): Plugin {
  let config: ResolvedConfig;

  return {
    name: "copy-compiled-assets",
    apply: "build",

    configResolved(_config) {
      config = _config;
    },

    async writeBundle() {
      try {
        const outputDir = path.resolve(config.root, "../../apps/web/public/js");
        const distDir = path.resolve(config.root, options.distDir);

        // Create the output directory if it doesn't exist
        await ensureDirectoryExists(outputDir);
        console.log(`Ensured directory exists: ${outputDir}`);

        // Check if the dist directory exists
        if (!(await distDirExists(distDir, options.skipDirectoryCheck))) return; // Skip further processing

        // Copy files from distDir to outputDir
        const copiedFiles = await copyDistFiles(distDir, outputDir, options);

        console.log(`Copied ${String(copiedFiles)} files to ${outputDir} (${options.filename})`);

        // The survey runtime fetches these at display time instead of carrying all of them in the
        // bundle, so they are a build output like the bundle itself — see `loadLanguage`. Declared in
        // turbo.json alongside it, or a cached build would restore the bundle without them and every
        // non-English survey would quietly render English.
        if (options.localesDir) {
          const localesOutputDir = path.resolve(outputDir, "locales");
          const copied = await replaceDirectory(options.localesDir, localesOutputDir, (file) =>
            file.endsWith(".json")
          );

          console.log(`Copied ${String(copied)} locale files to ${localesOutputDir}`);
        }

        // The survey runtime fetches the typed-signature font only when a respondent opens a Signature
        // element's Type tab, so it stays out of the bundle and is copied beside it like the locales —
        // and, for the same reason, replaced rather than copied over, and declared in turbo.json.
        if (options.fontsDir) {
          const fontsOutputDir = path.resolve(outputDir, "fonts");
          const copied = await replaceDirectory(
            options.fontsDir,
            fontsOutputDir,
            (file) => file.endsWith(".woff2") || file.endsWith(".txt")
          );

          console.log(`Copied ${String(copied)} font files to ${fontsOutputDir}`);
        }
      } catch (error) {
        if (options.skipDirectoryCheck) {
          console.error(
            `Warning: Error during copy operation, but continuing due to skipDirectoryCheck: ${String(error)}`
          );
        } else {
          throw error;
        }
      }
    },
  };
}
