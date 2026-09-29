import { access, copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { type Plugin, type ResolvedConfig } from "vite";

interface CopyCompiledAssetsPluginOptions {
  filename: string;
  distDir: string;
  skipDirectoryCheck?: boolean; // New option to skip checking non-existent directories
  localesDir?: string; // Locale JSON to publish beside the bundle for on-demand loading
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
        try {
          await access(distDir);
        } catch (error) {
          if ((error as { code: string }).code === "ENOENT") {
            console.error(`Error: Distribution directory ${distDir} does not exist`);
            if (!options.skipDirectoryCheck) {
              throw error;
            } else {
              console.log(`Skipping directory check as skipDirectoryCheck is enabled`);
              return; // Skip further processing
            }
          } else {
            throw error;
          }
        }

        // Copy files from distDir to outputDir
        const filesToCopy = await readdir(distDir);
        let copiedFiles = 0;

        for (const file of filesToCopy) {
          const srcFile = path.resolve(distDir, file);
          const destFile = path.resolve(outputDir, file.replace("index", options.filename));

          try {
            // Check if the srcFile is a regular file before copying
            const fileStat = await stat(srcFile);
            if (!fileStat.isFile()) {
              continue; // Skip directories, or other non-regular files
            }

            await copyFile(srcFile, destFile);
            copiedFiles++;
          } catch (error) {
            if ((error as { code: string }).code === "ENOENT" && options.skipDirectoryCheck) {
              console.log(`Skipping non-existent file: ${srcFile}`);
              continue;
            }
            throw error;
          }
        }

        console.log(`Copied ${String(copiedFiles)} files to ${outputDir} (${options.filename})`);

        // The survey runtime fetches these at display time instead of carrying all of them in the
        // bundle, so they are a build output like the bundle itself — see `loadLanguage`. Declared in
        // turbo.json alongside it, or a cached build would restore the bundle without them and every
        // non-English survey would quietly render English.
        if (options.localesDir) {
          const localesOutputDir = path.resolve(outputDir, "locales");

          // Replace the directory rather than copy over it. Turbo captures every file this glob matches
          // after the task runs, whoever wrote it, so a locale left behind by an older build (a renamed
          // tag, a dropped language) would be captured into the cache entry and restored on every hit —
          // outliving its source, and making the same cache key hold different bytes run to run.
          await rm(localesOutputDir, { recursive: true, force: true });
          await ensureDirectoryExists(localesOutputDir);

          const localeFiles = (await readdir(options.localesDir)).filter((file) => file.endsWith(".json"));
          for (const file of localeFiles) {
            await copyFile(path.resolve(options.localesDir, file), path.resolve(localesOutputDir, file));
          }

          console.log(`Copied ${String(localeFiles.length)} locale files to ${localesOutputDir}`);
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
