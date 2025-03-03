/* eslint-disable no-console -- Console logs are allowed for plguins*/
import { access, copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { type Plugin, type ResolvedConfig } from "vite";

interface CopyCompiledAssetsPluginOptions {
  filename: string;
  distDir: string;
  skipDirectoryCheck?: boolean; // New option to skip checking non-existent directories
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
